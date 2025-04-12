const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema({
  userId: { type: String, ref: "User" },
  email: { type: String, required: true },
  stripe_payment_id: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  payment_method_type: { type: String, required: true },
  status: { type: String, enum: ["succeeded", "pending", "failed", "Other"], required: true },
  payment_method: { type: String },
  receipt_url: { type: String },
  //created_at: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model("Payment", PaymentSchema);
