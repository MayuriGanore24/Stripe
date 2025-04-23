// controllers/webhookController.js
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const Payment = require('../models/Payment');
const axios = require('axios');
const { giveUserAccessToTutorLMS } = require('../services/tutorLMSService');

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

exports.handleStripeWebhook = async (req, res) => {
  let event;

  if (process.env.NODE_ENV === 'development') {
    // In dev, Stripe signature check bypassed for easier testing
    event = req.body;
    console.log('🔧 Dev mode: using raw req.body');
  } else {
    const sig = req.headers['stripe-signature'];
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    } catch (err) {
      console.error(`❌ Webhook signature verification failed: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }

  console.log(`✅ Stripe event received: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error(`❌ Error processing webhook: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

async function handleCheckoutSessionCompleted(session) {
  // Only handle TutorLMS‑originated sessions
  if (!(session.metadata && session.metadata.source === 'tutorlms')) return;

  const customer = await stripe.customers.retrieve(session.customer);
  const email = customer.email;
  const user = await User.findOne({ email });
  if (!user) {
    console.log(`⚠️ User not found for email: ${email}`);
    return;
  }

  // Save payment record
  const payment = new Payment({
    userId: user._id,
    email,
    stripe_payment_id: session.payment_intent || session.id,
    amount: session.amount_total,
    currency: session.currency,
    payment_method_type: session.payment_method_types[0],
    status: 'succeeded',
    receipt_url: null,
  });
  await payment.save();

  // Handle subscription create/update
  if (session.subscription && session.metadata.course_id) {
    const sub = await stripe.subscriptions.retrieve(session.subscription);
    const courseId = session.metadata.course_id;

    const subData = {
      user_id: user._id,
      stripe_subscription_id: sub.id,
      course_id: courseId,
      sub_status: 'active',
      Start_Date: new Date(sub.current_period_start * 1000).toISOString(),
      End_Date: new Date(sub.current_period_end * 1000).toISOString(),
      auto_renew: !sub.cancel_at_period_end,
      updated_at: new Date(),
    };

    await Subscription.findOneAndUpdate(
      { stripe_subscription_id: sub.id },
      subData,
      { upsert: true }
    );

    // Enroll in WP via your custom endpoint
    try {
      const wpRes = await axios.post(
        'https://vtexai.kinsta.cloud/wp-json/custom/v1/enroll/',
        { user_email: email, course_id: courseId },
        { headers: { Authorization: `Bearer ${process.env.WP_API_KEY}` } }
      );
      console.log('✅ WordPress enroll response:', wpRes.status, wpRes.data);
    } catch (wpErr) {
      console.error('❌ WP enroll failed:', wpErr.response?.status, wpErr.response?.data);
    }

    // Also call your TutorLMS service
    await giveUserAccessToTutorLMS(email, courseId);
    console.log(`✅ TutorLMS access granted for ${email}`);
  }
}

async function handleInvoicePaymentSucceeded(invoice) {
  if (!invoice.subscription) return;

  const sub = await stripe.subscriptions.retrieve(invoice.subscription);
  const cust = await stripe.customers.retrieve(invoice.customer);
  const user = await User.findOne({ email: cust.email });
  if (!user) {
    console.log(`⚠️ User not found: ${cust.email}`);
    return;
  }

  const payment = new Payment({
    userId: user._id,
    email: cust.email,
    stripe_payment_id: invoice.payment_intent,
    amount: invoice.amount_paid,
    currency: invoice.currency,
    payment_method_type: invoice.payment_method_types?.[0] || 'unknown',
    status: 'succeeded',
    receipt_url: invoice.hosted_invoice_url,
  });
  await payment.save();

  await Subscription.updateOne(
    { stripe_subscription_id: invoice.subscription },
    {
      $set: {
        sub_status: 'active',
        End_Date: new Date(sub.current_period_end * 1000).toISOString(),
        updated_at: new Date(),
      }
    }
  );
  console.log(`✅ Subscription updated for ${invoice.subscription}`);
}

async function handleInvoicePaymentFailed(invoice) {
  if (!invoice.subscription) return;
  await Subscription.updateOne(
    { stripe_subscription_id: invoice.subscription },
    { $set: { sub_status: 'failed', updated_at: new Date() } }
  );
  console.log(`⚠️ Payment failed for subscription ${invoice.subscription}`);
}

async function handleSubscriptionUpdated(subscription) {
  const existing = await Subscription.findOne({ stripe_subscription_id: subscription.id });
  if (!existing) return console.log(`⚠️ No sub record for ${subscription.id}`);

  let status = 'active';
  if (subscription.status === 'canceled' || subscription.cancel_at_period_end) status = 'cancel';
  else if (subscription.status !== 'active') status = 'other';

  await Subscription.updateOne(
    { stripe_subscription_id: subscription.id },
    {
      $set: {
        sub_status: status,
        auto_renew: !subscription.cancel_at_period_end,
        End_Date: subscription.cancel_at
          ? new Date(subscription.cancel_at * 1000).toISOString()
          : new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date()
      }
    }
  );
  console.log(`🔁 Subscription ${subscription.id} → ${status}`);
}

async function handleSubscriptionDeleted(subscription) {
  await Subscription.updateOne(
    { stripe_subscription_id: subscription.id },
    { $set: { sub_status: 'cancel', auto_renew: false, updated_at: new Date() } }
  );
  console.log(`❌ Subscription deleted: ${subscription.id}`);
}
