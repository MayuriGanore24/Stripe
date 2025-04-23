const mongoose = require("mongoose");
const StripePrice= require("../models/StripePrice");
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
    });
    console.log("MongoDB Connected");
    // const plans = [
    //   {
    //     plan_type: 'Emerging tech',
    //     course_id: '1',
    //     stripe_price_id: 'price_1RFBoASBDPKI6dEzLTz2guwo',
    //     stripe_product_id: 'prod_S9Un0ax8YO62jX',
    //     price_type: 'Monthly',
    //     price: 50
    //   },
    //   {
    //     plan_type: 'HealthTech AI',
    //     course_id: '2',
    //     stripe_price_id: 'price_1RFC33SBDPKI6dEzP7nJ5xY5',
    //     stripe_product_id: 'prod_S9V3nz6jbSjhQE',
    //     price_type: 'Monthly',
    //     price: 50
    //   },
    //   {
    //     plan_type: 'FlexPick',
    //     course_id: '3',
    //     stripe_price_id: 'price_1RFC4ESBDPKI6dEzWnIEGvij',
    //     stripe_product_id: 'prod_S9V4AwO3RLVQvi',
    //     price_type: 'Monthly',
    //     price: 50
    //   },
    //   {
    //     plan_type: 'Emerging tech',
    //     course_id: '5',
    //     stripe_price_id: 'price_1RFYPiSBDPKI6dEzCxgPcilb',
    //     stripe_product_id: 'prod_S9sAOHLRT9Cczm',
    //     price_type: 'Annual',
    //     price: 600
    //   },
    //   {
    //     plan_type: 'HealthTech AI',
    //     course_id: '4',
    //     stripe_price_id: 'price_1RFYOWSBDPKI6dEzpEN633Zb',
    //     stripe_product_id: 'prod_S9s8slAMCGIJ5g',
    //     price_type: 'Annual',
    //     price: 600
    //   },
    // ];

    // StripePrice.insertMany(plans)
    //   .then(docs => console.log('Inserted plans:', docs))
    //   .catch(err => console.error('Insert error:', err));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
