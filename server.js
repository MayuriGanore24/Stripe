require('dotenv').config();
const express = require("express");
const cors = require("cors");
const path = require('path'); 
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const connectDB = require("./config/db");
const errorHandler = require('./middleware/errorHandler');
const StripePrice = require('./models/StripePrice');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const userRoutes = require("./routes/userRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const authRoutes = require('./routes/authRoutes');
const testRoutes = require('./routes/testRoutes');
const session = require('express-session');
const app = express();

// Set up session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // Only use secure in production
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

console.log("session", session);

const PORT = process.env.PORT || 5000;
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Stripe payment route (Stripe webhook expects raw body)
app.use('/stripe', paymentRoutes);

// ✅ General Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// ✅ Connect to DB
connectDB();

// ✅ API Routes
app.get("/", (req, res) => res.send("API is running..."));

app.post('/create-checkout', async (req, res) => {
  try {
    const {
      itemId = '',
      itemType = '',
      priceId,
      email = '',
      userId = ''
    } = req.body;

    const customerEmail = (req.session?.user?.email || email || "ganoremayuri24@gmail.com");

    if (!priceId) {
      return res.status(400).json({ message: 'Missing priceId' });
    }

    if (!customerEmail) {
      return res.status(400).json({ message: 'Customer email is required' });
    }

    // First, find or create a Stripe customer
    let customerId;
    
    // Try to find an existing customer in Stripe
    const customers = await stripe.customers.list({
      email: customerEmail,
      limit: 1
    });

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      // Create a new customer
      const newCustomer = await stripe.customers.create({
        email: customerEmail,
        metadata: {
          user_id: userId || 'unknown',
          source: 'express_app'
        }
      });
      customerId = newCustomer.id;
    }

    const successUrl = `${req.protocol}://${req.get('host')}/subscription.html`;
    const cancelUrl = `${req.protocol}://${req.get('host')}/cancel.html`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        itemId: itemId.toString(),
        itemType: itemType,
        userId: userId || 'unknown'
      }
    });

    console.log('Created checkout session ID:', session.id);

    res.json({
      url: session.url,
      sessionId: session.id
    });
    
  } catch (error) {
    console.error('Stripe createCheckoutSession error:', error);
    res.status(500).json({ 
      message: 'Stripe error', 
      error: error.message,
      details: error.raw ? error.raw.message : null
    });
  }
});

// API route to get subscription details from a session ID
app.get('/api/subscription-from-session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    // Retrieve the session with expanded subscription object
    const session = await stripe.checkout.sessions.retrieve(
      sessionId,
      { expand: ['subscription'] }
    );
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // If the session doesn't have a subscription yet (e.g., payment not completed)
    if (!session.subscription) {
      return res.status(202).json({ 
        message: 'Subscription not yet available. Payment may still be processing.',
        sessionStatus: session.status,
        paymentStatus: session.payment_status
      });
    }
    
    res.json({
      subscription: session.subscription,
      sessionStatus: session.status
    });
    
  } catch (error) {
    console.error('Error retrieving subscription from session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route to handle the cancel page
app.get('/cancel', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cancel.html'));
});

app.use("/api/user", userRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/stripe", invoiceRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", testRoutes);

// ✅ Error handler
app.use(errorHandler);

// API route for courses
app.get('/api/courses/:id', async (req, res) => {
  try {
    const courseId = req.params.id;
    const course = await StripePrice.findOne({ course_id: courseId });
    
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    
    res.json(course);
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.get('/api/courses', async (req, res) => {
  try {
    const courses = await StripePrice.find({});
    res.json(courses);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ✅ Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});