const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  stripe_customer_id: { type: String, required: true },
  learndash_user_id: { type: String },
  createdAt: { type: Date, default: Date.now },
  payment_method_id:{type:String,required:false},
  password:{type:String,required:true}
});

module.exports = mongoose.model("User", UserSchema);
