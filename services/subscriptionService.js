// subscriptionService.js
const mongoose = require("mongoose");
const Subscription = require("../models/Subscription");
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { PLAN_PRICE_MAPPING } = require("./stripeService");
const User = require("../models/User");

class SubscriptionService {
  async createSubscription(subscriptionData) {
    try {
      const { UserID, email, stripe_payment_id, plan_id, auto_renew, payment_method, Solution_id } = subscriptionData;

      // Validate plan_id
      if (!PLAN_PRICE_MAPPING[plan_id]) {
        throw new Error(`Invalid plan_id: ${plan_id}. Available plans are: ${Object.keys(PLAN_PRICE_MAPPING).join(", ")}`);
      }

      // First, find or create a Stripe customer
      let customerId;

      // Try to find user in your database that has the Stripe customer ID
      const user = await User.findOne({ email });

      if (!user) {
        throw new Error(`User with email ${email} not found`);
      }

      if (user && user.stripe_customer_id) {
        // Use existing customer ID
        customerId = user.stripe_customer_id; 
      } else {
        // Look up the customer in Stripe by email
        const customers = await stripe.customers.list({
          email,
          limit: 1
        });

        if (customers.data.length > 0) {
          // Customer exists in Stripe
          customerId = customers.data[0].id;

          // Update your User model with the Stripe customer ID if it wasn't there
          await User.findByIdAndUpdate(user._id, { stripe_customer_id: customerId });
        } else {
          // Create a new customer in Stripe
          const newCustomer = await stripe.customers.create({
            email,
            metadata: {
              user_id: String(UserID),
              source: 'express_app' // To identify where the customer was created
            }
          });
          customerId = newCustomer.id;

          // Update user with new Stripe customer ID
          await User.findByIdAndUpdate(user._id, { stripe_customer_id: customerId });
        }
      }

      // Create subscription in Stripe using the customer ID
      const stripeSubscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: PLAN_PRICE_MAPPING[plan_id] }],
        expand: ["latest_invoice.payment_intent"],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        metadata: {
          source: 'express_app',
          user_id: String(UserID),
          course_id: Solution_id ? String(Solution_id) : 'none'
        }
      });

      // Create local subscription record
      const subscription = new Subscription({
        _id: new mongoose.Types.ObjectId(),
        UserID,
        email,
        stripe_payment_id,
        stripe_subscription_id: stripeSubscription.id,
        plan_id,
        Solution_id: Solution_id || null,
        auto_renew: auto_renew !== undefined ? auto_renew : true,
        sub_status: 'active',
        payment_method,
        start_date: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
        End_Date: stripeSubscription.cancel_at ?
          new Date(stripeSubscription.cancel_at * 1000).toISOString() :
          new Date(stripeSubscription.current_period_end * 1000).toISOString(),
      });

      await subscription.save();
      return {
        subscription,
        client_secret: stripeSubscription.latest_invoice.payment_intent.client_secret
      };
    } catch (error) {
      throw new Error(`Create subscription error: ${error.message}`);
    }
  }

  async updateSubscriptionStatus(subscriptionId) {
    try {
      // First check if we have a stripe_subscription_id
      let subscription = await Subscription.findById(subscriptionId);

      // If not found, try to find by stripe_payment_id
      if (!subscription) {
        subscription = await Subscription.findOne({ stripe_payment_id: subscriptionId });
      }

      if (!subscription) {
        // No local subscription found - might be coming from Tutor LMS
        const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_payment_id);

        return { subscription: null, stripeSubscription };
      }

      // Get subscription from Stripe
      const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_payment_id);

      // Determine subscription status based on Stripe status
      let status = 'active';
      if (stripeSubscription.status === 'canceled' || stripeSubscription.cancel_at_period_end) {
        status = 'cancel';
      } else if (stripeSubscription.status !== 'active') {
        status = 'other';
      }

      // Update local subscription
      subscription.sub_status = status;
      subscription.auto_renew = !stripeSubscription.cancel_at_period_end;
      subscription.End_Date = stripeSubscription.cancel_at ?
        new Date(stripeSubscription.cancel_at * 1000).toISOString() :
        new Date(stripeSubscription.current_period_end * 1000).toISOString();
      subscription.updated_at = new Date();

      await subscription.save();

      return { subscription, stripeSubscription };
    } catch (error) {
      throw new Error(`Update subscription status error: ${error.message}`);
    }
  }

  async cancelSubscription(subscriptionId) {
    try {
      // First check if we have a stripe_subscription_id
      let subscription = await Subscription.findOne({ stripe_subscription_id: subscriptionId });

      // If not found, try to find by stripe_payment_id
      if (!subscription) {
        subscription = await Subscription.findOne({ stripe_payment_id: subscriptionId });
      }

      if (!subscription) {
        // No local subscription found
        const canceledSubscription = await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true
        });
        return { subscription: null, canceledSubscription };
      }

      // Cancel subscription in Stripe
      const canceledSubscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });

      // Update local subscription
      subscription.sub_status = 'cancel';
      subscription.auto_renew = false;
      subscription.End_Date = new Date(canceledSubscription.current_period_end * 1000).toISOString();
      subscription.updated_at = new Date();

      await subscription.save();

      return { subscription, canceledSubscription };
    } catch (error) {
      throw new Error(`Cancel subscription error: ${error.message}`);
    }
  }

  async syncSubscriptions(email) {
    try {
      const user = await User.findOne({ email });

      if (!user) {
        throw new Error(`User with email ${email} not found`);
      }

      // If user doesn't have a Stripe customer ID, find or create one
      if (!user.stripe_customer_id) {
        const customers = await stripe.customers.list({ email, limit: 1 });

        if (customers.data.length > 0) {
          user.stripe_customer_id = customers.data[0].id;
          await user.save();
        } else {
          // No Stripe customer found - nothing to sync
          return { updated: [], created: [] };
        }
      }

      // Get all subscriptions from Stripe
      const stripeSubscriptions = await stripe.subscriptions.list({
        customer: user.stripe_customer_id,
        status: 'all'
      });

      const updated = [];
      const created = [];

      // Process each subscription
      for (const stripeSubscription of stripeSubscriptions.data) {
        // Determine status
        let status = 'active';
        if (stripeSubscription.status === 'canceled' || stripeSubscription.cancel_at_period_end) {
          status = 'cancel';
        } else if (stripeSubscription.status !== 'active') {
          status = 'other';
        }

        // Get more details about the subscription
        const paymentMethodId = stripeSubscription.default_payment_method;
        let paymentMethod = 'card';

        if (paymentMethodId) {
          const paymentMethodDetails = await stripe.paymentMethods.retrieve(paymentMethodId);
          paymentMethod = paymentMethodDetails.type;
        }

        // Determine plan ID from metadata or fallback to price ID
        let planId = 'Unknown';
        let solutionId = null;

        if (stripeSubscription.metadata && stripeSubscription.metadata.plan_id) {
          planId = stripeSubscription.metadata.plan_id;
        } else if (stripeSubscription.items.data.length > 0) {
          // Find the plan ID that maps to this price
          const priceId = stripeSubscription.items.data[0].price.id;

          for (const [plan, price] of Object.entries(PLAN_PRICE_MAPPING)) {
            if (price === priceId) {
              planId = plan;
              break;
            }
          }
        }

        // Check for Solution_id / course_id in metadata
        if (stripeSubscription.metadata && stripeSubscription.metadata.course_id) {
          solutionId = stripeSubscription.metadata.course_id;
        }

        // Find if subscription exists locally
        const existingSubscription = await Subscription.findOne({
          stripe_subscription_id: stripeSubscription.id
        });

        const subscriptionData = {
          UserID: user._id,
          email: user.email,
          stripe_payment_id: stripeSubscription.latest_invoice || stripeSubscription.id,
          stripe_subscription_id: stripeSubscription.id,
          plan_id: planId,
          Solution_id: solutionId,
          auto_renew: !stripeSubscription.cancel_at_period_end,
          sub_status: status,
          payment_method: paymentMethod,
          start_date: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
          End_Date: stripeSubscription.cancel_at ?
            new Date(stripeSubscription.cancel_at * 1000).toISOString() :
            new Date(stripeSubscription.current_period_end * 1000).toISOString(),
          updated_at: new Date()
        };

        if (existingSubscription) {
          // Update existing subscription
          await Subscription.updateOne(
            { _id: existingSubscription._id },
            { $set: subscriptionData }
          );
          updated.push({
            id: existingSubscription._id,
            stripe_id: stripeSubscription.id,
            status
          });
        } else {
          // Create new subscription
          const newSubscription = new Subscription({
            _id: new mongoose.Types.ObjectId(),
            ...subscriptionData,
            created_at: new Date()
          });
          await newSubscription.save();
          created.push({
            id: newSubscription._id,
            stripe_id: stripeSubscription.id,
            status
          });
        }
      }

      return { updated, created };
    } catch (error) {
      throw new Error(`Sync subscriptions error: ${error.message}`);
    }
  }

  async getUserSubscriptions(userId) {
    try {
      return await Subscription.find({ UserID: userId }).sort({ created_at: -1 });
    } catch (error) {
      throw new Error(`Get user subscriptions error: ${error.message}`);
    }
  }

  // New method to verify access for Tutor LMS courses
  async verifyTutorLMSAccess(userId, courseId) {
    try {
      // Find active subscriptions for this course
      const subscription = await Subscription.findOne({
        UserID: userId,
        Solution_id: courseId,
        sub_status: 'active',
        End_Date: { $gt: new Date().toISOString() }
      });

      if (!subscription) {
        return { hasAccess: false };
      }

      return {
        hasAccess: true,
        subscription
      };
    } catch (error) {
      throw new Error(`Verify access error: ${error.message}`);
    }
  }
}

module.exports = new SubscriptionService();