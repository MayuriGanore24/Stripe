const tutorLMSService = require('../services/tutorLMSService');
const User = require('../models/User');
const subscriptionService = require('../services/subscriptionService');

exports.enrollUserInCourse = async (req, res) => {
    try {
        const { userId, courseId } = req.body;

        if (!userId || !courseId) {
            return res.status(400).json({ error: 'User ID and course ID are required' });
        }

        // First check if user already has access
        const accessCheck = await subscriptionService.verifyTutorLMSAccess(userId, courseId);

        if (accessCheck.hasAccess) {
            return res.status(200).json({
                message: 'User already has access to this course',
                subscription: accessCheck.subscription
            });
        }

        // Enroll user in the course
        const enrollmentResult = await tutorLMSService.enrollUserInCourse(userId, courseId);

        res.status(201).json({
            message: 'User enrolled in course successfully',
            enrollment: enrollmentResult
        });
    } catch (error) {
        console.error('Enroll user error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.verifyCourseAccess = async (req, res) => {
    try {
        const { userId, courseId } = req.params;

        if (!userId || !courseId) {
            return res.status(400).json({ error: 'User ID and course ID are required' });
        }

        // First check access using local subscriptions
        const localAccessCheck = await subscriptionService.verifyTutorLMSAccess(userId, courseId);

        if (localAccessCheck.hasAccess) {
            return res.status(200).json({
                hasAccess: true,
                source: 'database',
                subscription: localAccessCheck.subscription
            });
        }

        // If no local access, check with WordPress/TutorLMS
        const wpAccessCheck = await tutorLMSService.verifyCourseAccess(userId, courseId);

        res.status(200).json(wpAccessCheck);
    } catch (error) {
        console.error('Verify access error:', error);
        res.status(500).json({ error: error.message });
    }
};

// New method for testing: manually force enrollment
exports.forceEnrollUserInCourse = async (req, res) => {
    try {
        const { userId, courseId, stripeSubscriptionId, planId } = req.body;

        if (!userId || !courseId) {
            return res.status(400).json({ error: 'User ID and course ID are required' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Create a subscription record directly
        const subscriptionData = {
            UserID: userId,
            email: user.email,
            stripe_payment_id: stripeSubscriptionId || 'manual_enrollment_' + Date.now(),
            stripe_subscription_id: stripeSubscriptionId || null,
            plan_id: planId || 'manual_enrollment',
            Solution_id: courseId,
            auto_renew: false,
            sub_status: 'active',
            payment_method: 'manual',
            start_date: new Date().toISOString(),
            End_Date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
        };

        const subscription = await subscriptionService.createSubscription(subscriptionData);

        // Also try to enroll in TutorLMS if possible
        let tutorLMSEnrollment = null;
        try {
            tutorLMSEnrollment = await tutorLMSService.enrollUserInCourse(userId, courseId);
        } catch (enrollError) {
            console.warn('TutorLMS enrollment failed:', enrollError.message);
        }

        res.status(201).json({
            message: 'User forcefully enrolled in course',
            subscription: subscription.subscription,
            tutorLMSEnrollment
        });
    } catch (error) {
        console.error('Force enroll error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Method to simulate a webhook from TutorLMS/Stripe
exports.simulateWebhook = async (req, res) => {
    try {
        const { eventType, data } = req.body;

        if (!eventType || !data) {
            return res.status(400).json({ error: 'Event type and data are required' });
        }

        console.log(`Processing simulated webhook event: ${eventType}`);
        console.log('Event data:', JSON.stringify(data, null, 2));
        // Create a mock event object that mimics Stripe's webhook format
        const mockEvent = {
            type: eventType,
            data: {
                object: data
            }
        };

        // Process the mock event
        const webhookResult = await processWebhookEvent(mockEvent);

        res.status(200).json({
            message: 'Webhook simulation processed',
            result: webhookResult
        });
    } catch (error) {
        console.error('Webhook simulation error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Helper function to process webhook events
async function processWebhookEvent(event) {
    // This would normally be in your webhookController
    switch (event.type) {
        case 'checkout.session.completed':
            return await handleCheckoutSessionCompleted(event.data.object);

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
            return await handleSubscriptionUpdated(event.data.object);

        case 'customer.subscription.deleted':
            return await handleSubscriptionDeleted(event.data.object);

        default:
            return { processed: false, reason: 'Unhandled event type' };
    }
}

// Mock implementations of webhook handlers for testing
async function handleCheckoutSessionCompleted(session) {
    try {
        // Check if this is a Tutor LMS checkout session
        const isTutorLMS = session.metadata && session.metadata.source === 'tutorlms';

        if (!isTutorLMS) {
            return { processed: false, reason: 'Not a Tutor LMS checkout session' };
        }

        // Find user by email
        let email = session.customer_email;

        // If no email directly in session, try to get it from customer object
        if (!email && session.customer) {
            // For simulation, we can accept the email directly in the customer field
            email = typeof session.customer === 'string' && session.customer.includes('@')
                ? session.customer
                : null;
        }

        if (!email) {
            return { processed: false, reason: 'No customer email found in session' };
        }

        const user = await User.findOne({ email });

        if (!user) {
            return { processed: false, reason: `User with email ${email} not found` };
        }

        const courseId = session.metadata.course_id;
        if (!courseId) {
            return { processed: false, reason: 'No course ID in metadata' };
        }

        // Create subscription record
        const subscriptionData = {
            UserID: user._id,
            email: user.email,
            stripe_payment_id: session.payment_intent || session.id,
            stripe_subscription_id: session.subscription || `sim_${Date.now()}`,
            plan_id: session.metadata.plan_id || 'basic',
            Solution_id: courseId,
            auto_renew: true,
            sub_status: 'active',
            payment_method: session.payment_method_types?.[0] || 'card',
            start_date: new Date().toISOString(),
            End_Date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
        };

        const subscription = await subscriptionService.createSubscription(subscriptionData);

        // Also try to enroll in TutorLMS if possible
        let tutorLMSEnrollment = null;
        try {
            tutorLMSEnrollment = await tutorLMSService.enrollUserInCourse(user._id, courseId);
        } catch (enrollError) {
            console.warn('TutorLMS enrollment failed:', enrollError.message);
        }

        return {
            processed: true,
            subscription: subscription.subscription,
            tutorLMSEnrollment,
            userId: user._id,
            courseId
        };
    } catch (error) {
        console.error('Error in handleCheckoutSessionCompleted:', error);
        return { processed: false, error: error.message };
    }
}
async function handleInvoicePaymentSucceeded(invoice) {
    try {
        if (!invoice.subscription) {
            return { processed: false, reason: 'Not a subscription invoice' };
        }

        // Here you would implement the logic to update subscription dates
        // For testing, return a simplified response
        return {
            processed: true,
            message: 'Would update subscription dates',
            subscriptionId: invoice.subscription
        };
    } catch (error) {
        return { processed: false, error: error.message };
    }
}

async function handleSubscriptionUpdated(subscription) {
    try {
        // For testing, return a simplified response
        return {
            processed: true,
            message: 'Would update subscription status',
            subscriptionId: subscription.id,
            status: subscription.status
        };
    } catch (error) {
        return { processed: false, error: error.message };
    }
}

async function handleSubscriptionDeleted(subscription) {
    try {
        // For testing, return a simplified response
        return {
            processed: true,
            message: 'Would mark subscription as cancelled',
            subscriptionId: subscription.id
        };
    } catch (error) {
        return { processed: false, error: error.message };
    }
}