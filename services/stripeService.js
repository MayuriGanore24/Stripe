require('dotenv').config();
const stripeApiKey = process.env.STRIPE_SECRET_KEY;

if (!stripeApiKey) {
  throw new Error("STRIPE_SECRET_KEY is missing. Please check your .env file.");
}

const stripe = require('stripe')(stripeApiKey);

const PLAN_PRICE_MAPPING = {
  "Healthtech": "price_1RD351SBDPKI6dEzL5UPnZ00",
  "Emerging tech": "price_1RD37ASBDPKI6dEzWH3HAmC8"
};

class StripeService {
  async createCheckoutSession({ name, amount, email, itemId, itemType, successUrl, cancelUrl }) {
    try {
      console.log("Received body in createCheckoutSession:", req.body);
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name,
              },
              unit_amount: amount, // amount in cents (1000 = $10)
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          item_id: itemId.toString(),
          item_type: itemType,
          source: 'node-stripe'
        },
        customer_email: email,
      });

      return session;
    } catch (error) {
      console.error("Stripe createCheckoutSession error:", error);
      throw new Error(`Stripe session error: ${error.message}`);
    }
  }

  async retrieveSubscription(subscriptionId) {
    try {
      return await stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      console.error("Stripe retrieveSubscription error:", error);
      throw new Error(`Stripe error: ${error.message}`);
    }
  }

  async cancelSubscription(subscriptionId) {
    try {
      return await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });
    } catch (error) {
      console.error("Stripe cancelSubscription error:", error);
      throw new Error(`Stripe cancel error: ${error.message}`);
    }
  }

  async findCustomerByEmail(email) {
    try {
      const customers = await stripe.customers.list({ email });
      return customers.data.length > 0 ? customers.data[0] : null;
    } catch (error) {
      console.error("Stripe findCustomerByEmail error:", error);
      throw new Error(`Stripe customer search error: ${error.message}`);
    }
  }

  async listSubscriptions(customerId) {
    try {
      return await stripe.subscriptions.list({ customer: customerId });
    } catch (error) {
      console.error("Stripe listSubscriptions error:", error);
      throw new Error(`Stripe list subscriptions error: ${error.message}`);
    }
  }

  getSubscriptionStatus(stripeSubscription) {
    if (!stripeSubscription) return 'other';

    switch (stripeSubscription.status) {
      case 'active':
        return 'active';
      case 'canceled':
        return 'cancel';
      default:
        return 'other';
    }
  }
}

module.exports = { StripeService: new StripeService(), PLAN_PRICE_MAPPING };
