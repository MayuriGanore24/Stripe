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
require('dotenv').config();

// ✅ Debug STRIPE KEY
console.log('🔍 STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY);

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// ✅ Database Connection
connectDB();

// ✅ Main Routes
app.get("/", (req, res) => {
  res.send("API is running...");
});

// ✅ Custom Checkout Session Route
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

// ✅ Modular Routes
app.use("/api/user", userRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/stripe", invoiceRoutes);
app.use("/api/auth", authRoutes);

// ✅ Error Handler
app.use(errorHandler);

// ✅ Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});

module.exports = { stripe };
