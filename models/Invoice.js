const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  UserID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  email: {
    type: String,
    required: true
  },
  plan_id: {
    type: String,
    required: true
  },
  stripe_invoice_id: {
    type: String,
    required: true
  },
  Solution_id: {
    type: String,
    required: function() {
      return this.plan_id === 'PPC' || this.plan_id === 'FlexPicks';
    },
    maxlength: 1000
  },
  Sub_type: {
    type: String,
    enum: ['RECUR', 'ONETIME'],
    required: true
  },
  amount_due: {
    type: Number,
    required: true
  },
  Currency: {
    type: String,
    default: 'USD'
  },
  Status: {
    type: String,
    enum: ['draft', 'open', 'paid', 'uncollectible', 'void'],
    default: 'draft'
  },
  due_date: {
    type: Date,
    required: true
  },
  receipt_url: {
    type: String,
    default: null
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, { versionKey: false });

// Update the updated_at field before saving
invoiceSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);