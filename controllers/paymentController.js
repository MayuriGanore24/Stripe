// controllers/paymentController.js
require('dotenv').config();
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const str = require('stripe');
const stripe= str(process.env.STRIPE_SECRET_KEY)
const User = require('../models/User');
const Payment = require('../models/Payment');
const mongoose = require('mongoose');
exports.addPaymentMethod = async (req, res) => {
  try {
    const { userId, paymentMethodId } = req.body;
    console.log(userId)
    if (!userId || !paymentMethodId) {
      return res.status(400).json({ error: 'User ID and payment method ID are required' });
    }

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check or create Stripe customer
    let customerId = user.stripe_customer_id;

    if (!customerId) {
      // Create a new customer
      const customer = await stripe.customers.create({
        email: user.email,
        payment_method: paymentMethodId,
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
        metadata: {
          user_id: userId
        }
      });
      customerId = customer.id;

      // Update user with stripe customer id
      await User.findByIdAndUpdate(userId, { stripe_customer_id: customerId });
    } else {
      // Attach payment method to existing customer
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });

      // Set as default payment method
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Payment method added successfully',
      customerId: customerId
    });
  } catch (error) {
    console.error('Add payment method error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.setDefaultPaymentMethod = async (req, res) => {
  try {
    const { userId, paymentMethodId } = req.body;

    if (!userId || !paymentMethodId) {
      return res.status(400).json({ error: 'User ID and payment method ID are required' });
    }

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has a Stripe customer ID
    if (!user.stripe_customer_id) {
      return res.status(400).json({ error: 'User does not have a Stripe customer account' });
    }

    try {
      // Attach payment method to customer - this is where the error is happening
      console.log(`Attaching payment method ${paymentMethodId} to customer ${user.stripe_customer_id}`);

      // Check if payment method already belongs to customer
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

      if (paymentMethod.customer && paymentMethod.customer !== user.stripe_customer_id) {
        // Detach from previous customer if needed
        await stripe.paymentMethods.detach(paymentMethodId);

        // Re-attach to current customer
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: user.stripe_customer_id,
        });
      } else if (!paymentMethod.customer) {
        // Attach to customer if not attached to any customer
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: user.stripe_customer_id,
        });
      }

      // Set as default payment method
      await stripe.customers.update(user.stripe_customer_id, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        }
      });

      console.log(`Successfully set ${paymentMethodId} as default for customer ${user.stripe_customer_id}`);

      res.status(200).json({
        success: true,
        message: 'Default payment method updated successfully',
        paymentMethodId: paymentMethodId
      });
    } catch (stripeError) {
      console.error('Stripe error:', stripeError);

      if (stripeError.type === 'StripeInvalidRequestError') {
        return res.status(400).json({
          error: `Invalid request to Stripe: ${stripeError.message}`,
          code: stripeError.code || 'stripe_error'
        });
      }

      throw stripeError; // Re-throw for the outer catch block
    }
  } catch (error) {
    console.error('Set default payment method error:', error);
    res.status(500).json({ error: error.message });
  }
};

// controllers/paymentController.js
exports.chargePayment = async (req, res) => {
  try {
    const { userId, amount, currency, description, paymentMethodId, return_url } = req.body;

    if (!userId || !amount || !currency) {
      return res.status(400).json({ error: 'User ID, amount, and currency are required' });
    }

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.stripe_customer_id && !paymentMethodId) {
      return res.status(400).json({ error: 'No payment method available' });
    }

    // Create payment intent with the proper configuration
    const paymentIntentOptions = {
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      customer: user.stripe_customer_id,
      description: description || 'One-time payment',
      metadata: {
        user_id: userId
      },
      // Handle specific payment method if provided
      payment_method: paymentMethodId || undefined,
      // Disable automatic payment methods that require redirects
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      }
    };

    // If a specific payment method is provided, confirm immediately
    if (paymentMethodId) {
      paymentIntentOptions.confirm = true;
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create(paymentIntentOptions);

    // If no specific payment method was provided, return client secret
    if (!paymentMethodId) {
      return res.status(200).json({
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      });
    }

    // Record payment in database if payment was confirmed
    if (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing') {
      const payment = new Payment({
        userId: userId,
        email: user.email,
        stripe_payment_id: paymentIntent.id,
        amount: amount,
        currency: currency,
        payment_method_type: paymentIntent.payment_method_types[0],
        status: paymentIntent.status,
        receipt_url: paymentIntent.charges?.data[0]?.receipt_url || null,
      });

      await payment.save();
    }

    res.status(200).json({
      success: true,
      message: 'Payment processed successfully',
      paymentId: paymentIntent.id,
      status: paymentIntent.status,
      receiptUrl: paymentIntent.charges?.data[0]?.receipt_url || null
    });
  } catch (error) {
    console.error('Charge payment error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteDefaultPaymentMethod = async (req, res) => {
  try {
    // Extract user ID from request body or params
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user || !user.stripe_customer_id) {
      return res.status(404).json({
        error: user ? 'No payment method found for this user' : 'User not found'
      });
    }

    // Get customer's default payment method
    const customer = await stripe.customers.retrieve(user.stripe_customer_id, {
      expand: ['invoice_settings.default_payment_method']
    });

    const defaultPaymentMethodId = customer.invoice_settings.default_payment_method?.id;

    if (!defaultPaymentMethodId) {
      return res.status(404).json({ error: 'No default payment method found' });
    }

    // Update customer to remove default payment method
    await stripe.customers.update(user.stripe_customer_id, {
      invoice_settings: { default_payment_method: null }
    });

    // Detach the payment method
    await stripe.paymentMethods.detach(defaultPaymentMethodId);

    res.status(200).json({
      success: true,
      message: 'Default payment method removed successfully'
    });
  } catch (error) {
    console.error('Delete payment method error:', error);
    res.status(500).json({ error: error.message });
  }
};