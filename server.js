const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const errorHandler = require('./middleware/errorHandler');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const userRoutes = require("./routes/userRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const authRoutes = require('./routes/authRoutes');
const { StripeService } = require('./services/stripeService');
const { giveUserAccessToTutorLMS } = require('./services/tutorLMSService');
require('dotenv').config();
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY); 


const app = express();
const PORT = process.env.PORT || 5000;
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
// ✅ Stripe Webhook needs raw body
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    console.log("✅ Received event:", event.type);
  } catch (err) {
    console.error('❌ Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Process event
  res.status(200).send();
  console.log(`Received event: ${event.type}`);
});



// ✅ Place AFTER webhook route
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// ✅ Connect DB
connectDB();

// ✅ Routes
app.get("/", (req, res) => res.send("API is running..."));
app.post('/create-checkout', async (req, res) => {
  const { name, amount, email, itemId, itemType } = req.body;
  try {
    const session = await StripeService.createCheckoutSession({
      name,
      amount,
      email,
      itemId,
      itemType,
      successUrl: 'http://localhost:3000/success',
      cancelUrl: 'http://localhost:3000/cancel'
    });
    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use("/api/user", userRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/stripe", invoiceRoutes);
app.use("/api/auth", authRoutes);
app.use(errorHandler);

// ✅ Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
