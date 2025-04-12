const Stripe = require("stripe");
const User = require("../models/User");
const Payment = require("../models/Payment");
const axios = require("axios");
const bcrypt = require("bcryptjs");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ✅ Create Stripe Customer (Now includes default_payment_method)
exports.createStripeCustomer = async (req, res) => {
  try {
    const { email, password } = req.body;

    const customer = await stripe.customers.create({ email });
 const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      email,
      stripe_customer_id: customer.id,
      password:hashedPassword,  // Ensuring this is passed
    });

    await user.save();

    res.status(201).json({ message: "Stripe customer created", user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// ✅ Set Default Payment Method
exports.createDefaultPaymentMethod = async (req, res) => {
  try {
    const { stripe_customer_id, payment_method_id } = req.body;

    // Attach the payment method to the customer
    await stripe.paymentMethods.attach(payment_method_id, { customer: stripe_customer_id });

    // Set as default payment method
    await stripe.customers.update(stripe_customer_id, {
      invoice_settings: { default_payment_method: payment_method_id },
    });

    // Update User model
    const user = await User.findOneAndUpdate(
      { stripe_customer_id },
      { default_payment_method_id: payment_method_id },
      { new: true }
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "Default payment method set successfully", user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Delete Default Payment Method
exports.deleteDefaultPaymentMethod = async (req, res) => {
  try {
    const { stripe_customer_id } = req.body;

    // Retrieve user
    const user = await User.findOne({ stripe_customer_id });
    if (!user) return res.status(404).json({ message: "User not found" });

    const payment_method_id = user.default_payment_method_id;
    if (!payment_method_id) return res.status(400).json({ message: "No default payment method found" });

    // Detach payment method from customer
    await stripe.paymentMethods.detach(payment_method_id);

    // Remove default payment method from User model
    user.default_payment_method_id = null;
    await user.save();

    res.status(200).json({ message: "Default payment method deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Charge Customer Using Default Payment Method
exports.chargePayment = async (req, res) => {
  try {
    const { stripe_customer_id, amount, currency } = req.body;

    // Retrieve user to get default payment method
    const user = await User.findOne({ stripe_customer_id });
    if (!user || !user.default_payment_method_id) {
      return res.status(400).json({ error: "No default payment method found. Please set one." });
    }

    // Create a payment intent using the default payment method
    const paymentIntent = await stripe.paymentIntents.create({
      customer: stripe_customer_id,
      amount,
      currency,
      payment_method: user.default_payment_method_id,
      confirm: true,
    });

    // Save payment details in the database
    const payment = new Payment({
      userId: stripe_customer_id,
      stripe_payment_id: paymentIntent.id,
      amount,
      currency,
      status: paymentIntent.status,
      receipt_url: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].receipt_url : null,
    });

    await payment.save();

    res.status(200).json({ message: "Payment successful", payment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Sync User with LearnDash
exports.syncLearnDashUser = async (req, res) => {
  try {
    const { email, learndash_user_id } = req.body;

    const user = await User.findOneAndUpdate(
      { email },
      { learndash_user_id },
      { new: true }
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    await axios.post(process.env.WORDPRESS_API_URL, { email, learndash_user_id });

    res.status(200).json({ message: "User synced with LearnDash", user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


