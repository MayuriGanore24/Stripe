// routes/subscriptionRoutes.js
const express = require('express');
const router = express.Router();

const subscriptionController = require('../controllers/subscriptionController');
const webhookController    = require('../controllers/webhookController');
const tutorLMSController   = require('../controllers/tutorLMSController');

// Custom raw‑body parser for Stripe webhooks
const stripeWebhookMiddleware = (req, res, next) => {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', chunk => { data += chunk; });
  req.on('end', () => {
    req.rawBody = data;
    next();
  });
  req.on('error', err => {
    console.error('❌ Webhook body parse error:', err);
    res.status(400).send('Invalid webhook payload');
  });
};

// Subscription management endpoints
router.post('/create', subscriptionController.createSubscription);
router.post('/status', subscriptionController.getSubscriptionStatus);
router.post('/sync', subscriptionController.syncSubscriptions);
router.get('/user/:userId', subscriptionController.getUserSubscriptions);
router.post('/cancel/:subscriptionId', subscriptionController.cancelSubscription);
// TutorLMS integration endpoints
router.post('/enroll-course', tutorLMSController.enrollAfterPayment);
// router.get('/verify-access/:userId/:courseId', tutorLMSController.verifyCourseAccess);
// router.post('/simulate-webhook', tutorLMSController.simulateWebhook);

// Stripe webhook endpoint (must use raw body)
router.post('/webhook', stripeWebhookMiddleware, webhookController.handleStripeWebhook);

module.exports = router;
