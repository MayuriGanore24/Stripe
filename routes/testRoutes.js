const express = require('express');
const router = express.Router();
const tutorLMSService = require('../services/tutorLMSService');
const { handleStripeWebhook } = require('../controllers/webhookController');

// Stripe requires raw body
router.post('/webhook', express.json(), async (req, res) => {
  let event;

  // Check for dev mode (you can also just use a flag like process.env.NODE_ENV !== 'production')
  const isTestFromPostman = !req.headers['stripe-signature'];

  try {
    if (!isTestFromPostman) {
      const sig = req.headers['stripe-signature'];
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } else {
      event = req.body; // Directly use body from Postman
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Your logic here
    console.log("✅ Simulated session from Postman:", session);

    res.status(200).send({ success: true, source: "postman-test" });
  } else {
    res.status(400).send({ message: 'Unhandled event type' });
  }
});
module.exports = router;
