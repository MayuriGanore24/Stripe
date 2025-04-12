// routes/subscriptionRoutes.js
const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const webhookController = require('../controllers/weebhook.controller');
const tutorLMSController = require('../controllers/tutorLMSController');

// Raw body parsing middleware for Stripe webhooks
const stripeWebhookMiddleware = (req, res, next) => {
    console.log('Webhook middleware started');
    let data = '';
    req.on('data', chunk => {
        data += chunk.toString();
    });

    req.on('end', () => {
        console.log('Raw body parsing complete');
        req.rawBody = data;
        next();
    });

    // Add error handling for the request parsing
    req.on('error', (err) => {
        console.error('Error parsing request body:', err);
        res.status(400).send('Error parsing request body');
    });
};

// Subscription routes
router.post('/create', subscriptionController.createSubscription);
router.post('/status', subscriptionController.getSubscriptionStatus);
router.post('/cancel', subscriptionController.cancelSubscription);
router.post('/sync', subscriptionController.syncSubscriptions);
router.get('/user/:userId', subscriptionController.getUserSubscriptions);

// TutorLMS integration routes
router.post('/enroll-course', tutorLMSController.enrollUserInCourse);
router.get('/verify-access/:userId/:courseId', tutorLMSController.verifyCourseAccess);

// Stripe webhook route (use raw body parser)
router.post('/webhook', bodyParser.raw({ type: 'application/json' }), webhookController.handleStripeWebhook);
// Add this line to your existing routes in subscriptionRoutes.js
router.post('/simulate-webhook', tutorLMSController.simulateWebhook);

module.exports = router;
