// webhookController.js
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const Payment = require('../models/Payment');
const mongoose = require('mongoose');

exports.handleStripeWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    if (process.env.NODE_ENV === 'development') {
        event = req.body;
        console.log('Using request body directly (signature check bypassed for testing)');
    } else {
        // Normal production code with signature verification
        const sig = req.headers['stripe-signature'];
        try {
            event = stripe.webhooks.constructEvent(
                req.rawBody,
                sig,
                process.env.STRIPE_WEBHOOK_SECRET
            );
        } catch (err) {
            console.error(`Webhook signature verification failed: ${err.message}`);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }
    }


    console.log(`Received Stripe event: ${event.type}`);

    try {
        // Handle different event types
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

            // Add additional events as needed

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        res.status(200).json({ received: true });
    } catch (err) {
        console.error(`Error processing webhook: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
};

// Handle successful checkout session (initial subscription)
async function handleCheckoutSessionCompleted(session) {
    // Check if this is a Tutor LMS checkout session
    const isTutorLMS = session.metadata && session.metadata.source === 'tutorlms';

    if (!isTutorLMS) {
        console.log('Not a Tutor LMS checkout session. Skipping.');
        return;
    }

    // Get customer email and subscription data
    const customer = await stripe.customers.retrieve(session.customer);
    const email = customer.email;

    // Find the user in your database
    const user = await User.findOne({ email });

    if (!user) {
        console.log(`User with email ${email} not found in database`);
        return;
    }

    // Get subscription information if it exists
    let subscription;
    if (session.subscription) {
        subscription = await stripe.subscriptions.retrieve(session.subscription);
    }

    // Record payment
    const payment = new Payment({
        userId: user._id,
        email: email,
        stripe_payment_id: session.payment_intent || session.id,
        amount: session.amount_total,
        currency: session.currency,
        payment_method_type: session.payment_method_types[0],
        status: 'succeeded',
        receipt_url: null, // Stripe doesn't provide receipt_url in checkout.session
    });

    await payment.save();

    // If there's a subscription, create or update subscription record
    if (subscription) {
        const courseId = session.metadata.course_id;

        const subscriptionData = {
            // your subscription setup
        };

        const existingSubscription = await Subscription.findOne({
            stripe_subscription_id: subscription.id
        });

        if (existingSubscription) {
            await Subscription.updateOne(
                { _id: existingSubscription._id },
                {
                    $set: {
                        ...subscriptionData,
                        _id: existingSubscription._id,
                        updated_at: new Date()
                    }
                }
            );
            console.log(`Updated subscription for user ${user._id}, course ${courseId}`);
        } else {
            const newSubscription = new Subscription(subscriptionData);
            await newSubscription.save();
            console.log(`Created new subscription for user ${user._id}, course ${courseId}`);
        }

        // 🔔 Trigger WordPress Enroll API
        try {
            const enrollResponse = await axios.post(
                'https://vtexai.kinsta.cloud/wp-json/custom/v1/enroll/',
                {
                    user_email: email,
                    course_id: courseId
                },
                {
                    headers: {
                        Authorization: `Bearer ${process.env.WP_API_KEY}`
                    }
                }
            );
            console.log('✅ Enroll API response:', enrollResponse.status, enrollResponse.data);
        } catch (error) {
            console.error('❌ Failed to enroll user in WordPress:', error.response?.status, error.response?.data);
        }
    }

}


// Handle successful invoice payment (renewals)
async function handleInvoicePaymentSucceeded(invoice) {
    if (!invoice.subscription) {
        console.log('Not a subscription invoice. Skipping.');
        return;
    }

    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    const customer = await stripe.customers.retrieve(invoice.customer);

    // Find user by email
    const user = await User.findOne({ email: customer.email });

    if (!user) {
        console.log(`User with email ${customer.email} not found in database`);
        return;
    }

    // Record payment
    const payment = new Payment({
        userId: user._id,
        email: customer.email,
        stripe_payment_id: invoice.payment_intent,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        payment_method_type: invoice.payment_method_types ? invoice.payment_method_types[0] : 'unknown',
        status: 'succeeded',
        receipt_url: invoice.hosted_invoice_url,
    });

    await payment.save();

    // Update subscription dates
    await Subscription.updateOne(
        { stripe_subscription_id: invoice.subscription },
        {
            $set: {
                sub_status: 'active',
                End_Date: new Date(subscription.current_period_end * 1000).toISOString(),
                updated_at: new Date()
            }
        }
    );

    console.log(`Updated subscription dates for subscription ${invoice.subscription}`);
}

// Handle failed invoice payment
async function handleInvoicePaymentFailed(invoice) {
    if (!invoice.subscription) {
        return;
    }

    // Update subscription status
    await Subscription.updateOne(
        { stripe_subscription_id: invoice.subscription },
        {
            $set: {
                sub_status: 'other', // Or 'failed' if you add this status
                updated_at: new Date()
            }
        }
    );

    console.log(`Updated subscription status to 'other' for ${invoice.subscription} due to payment failure`);
}

// Handle subscription updates
async function handleSubscriptionUpdated(subscription) {
    // Find the subscription in your database
    const existingSubscription = await Subscription.findOne({
        stripe_subscription_id: subscription.id
    });

    if (!existingSubscription) {
        console.log(`Subscription ${subscription.id} not found in database`);
        return;
    }

    let status = 'active';
    if (subscription.status === 'canceled' || subscription.cancel_at_period_end) {
        status = 'cancel';
    } else if (subscription.status !== 'active') {
        status = 'other';
    }

    // Update subscription status and dates
    await Subscription.updateOne(
        { _id: existingSubscription._id },
        {
            $set: {
                sub_status: status,
                auto_renew: !subscription.cancel_at_period_end,
                End_Date: subscription.cancel_at ?
                    new Date(subscription.cancel_at * 1000).toISOString() :
                    new Date(subscription.current_period_end * 1000).toISOString(),
                updated_at: new Date()
            }
        }
    );

    console.log(`Updated subscription ${subscription.id} status to ${status}`);
}

// Handle subscription deletion
async function handleSubscriptionDeleted(subscription) {
    await Subscription.updateOne(
        { stripe_subscription_id: subscription.id },
        {
            $set: {
                sub_status: 'cancel',
                auto_renew: false,
                updated_at: new Date()
            }
        }
    );

    console.log(`Marked subscription ${subscription.id} as cancelled`);
}