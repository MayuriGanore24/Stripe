const express = require("express");
const router = express.Router();
const { addPaymentMethod, chargePayment, deleteDefaultPaymentMethod, setDefaultPaymentMethod } = require("../controllers/paymentController");
const { createDefaultPaymentMethod } = require("../controllers/userController");
const { paymentLimiter } = require('../middleware/rateLimiter');
const validateRecaptcha = require('../middleware/recaptchaValidator');

router.post("/stripe/add-payment-method", paymentLimiter, addPaymentMethod);
router.post("/set-default-payment-method", paymentLimiter, setDefaultPaymentMethod);
router.delete("/delete-default-payment-method", validateRecaptcha, paymentLimiter, deleteDefaultPaymentMethod);
router.post("/stripe/charge", validateRecaptcha, paymentLimiter, chargePayment);



module.exports = router;
