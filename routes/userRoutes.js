const express = require("express");
const router = express.Router();
const { createStripeCustomer, syncLearnDashUser } = require("../controllers/userController");
const { setDefaultPaymentMethod } = require("../controllers/paymentController");

router.post("/stripe/createcustomer", createStripeCustomer);

router.post("/sync-learndash", syncLearnDashUser);

module.exports = router;
