// models/StripePrice.js

const mongoose = require('mongoose');

const StripePriceSchema = new mongoose.Schema({
  plan_type: {
    type: String,
    enum: ['Emerging tech', 'HealthTech AI', 'FlexPick', 'PPC'],
    required: true
  },
  course_id: {
    type: String,
    required: true
  },
  stripe_price_id: {
    type: String,
    required: true
  },
  stripe_product_id: {
    type: String,
    required: true
  },
  price_type: {
    type: String,
    enum: ['Monthly', 'Annual', 'Onetime', 'PPC'],
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  coupon: {
    type: Number,
    default: 0
  },
  valid_from: {
    type: Date
  },
  valid_to: {
    type: Date
  },
  miscellaneous: {
    type: String,
    default: ''
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt fields
});

module.exports = mongoose.model('StripePrice', StripePriceSchema);
