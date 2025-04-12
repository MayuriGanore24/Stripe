// models/Subscription.js
const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  UserID: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address'], 
    index: true 
  },
  stripe_payment_id: { 
    type: String, 
    required: true 
  },
  plan_id: { 
    type: String, 
    required: true 
  },
  Solution_id: { 
    type: String, 
    maxlength: 1000 
  },
  auto_renew: { 
    type: Boolean, 
    default: true 
  },
  sub_status: { 
    type: String, 
    enum: ['active', 'cancel', 'other'], 
    default: 'active' 
  },
  payment_method: { 
    type: String 
  },
  start_date: { 
    type: String 
  },
  End_Date: { 
    type: String 
  },
  created_at: { 
    type: Date, 
    default: Date.now 
  },
  updated_at: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('Subscription', subscriptionSchema);