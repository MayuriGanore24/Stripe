const express = require("express");
const router = express.Router();
const { addPaymentMethod, chargePayment, deleteDefaultPaymentMethod, setDefaultPaymentMethod } = require("../controllers/paymentController");
const { createDefaultPaymentMethod } = require("../controllers/userController");
const { paymentLimiter } = require('../middleware/rateLimiter');
const validateRecaptcha = require('../middleware/recaptchaValidator');

router.post("/stripe/add-payment-method", paymentLimiter, addPaymentMethod);
router.post("/set-default-payment-method", paymentLimiter, setDefaultPaymentMethod);
router.delete("/delete-default-payment-method", validateRecaptcha, paymentLimiter, deleteDefaultPaymentMethod);
router.post("/stripe/charge", validateRecaptcha, paymentLimiter, chargePayment);

// Add this to your paymentRoutes.js or create a new webhook handler

router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    let event;
    
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      
      // Now retrieve the subscription using the subscription ID from the session
      if (session.subscription) {
        try {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          console.log('Subscription created:', subscription.id);
          
          // Here you can save the subscription to your database
          // Call your subscriptionService to create a subscription record
          
        } catch (error) {
          console.error('Error retrieving subscription:', error);
        }
      }
    }
    
    res.json({received: true});
  });

module.exports = router;
