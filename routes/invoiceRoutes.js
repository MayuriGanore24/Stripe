const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController')
const  protect = require('../middleware/authMiddleware');

// POST /stripe/generate-invoice - Generate a new invoice
router.post('/invoice/generateinvoice', protect, invoiceController.generateInvoice);

// GET /stripe/invoices/:userId - Get all invoices for a user
router.get('/invoices/:userId', protect, invoiceController.getUserInvoices);

// GET /stripe/invoice/:invoiceId - Get invoice details
router.get('/invoice/:invoiceId', protect, invoiceController.getInvoiceDetails);

// PUT /stripe/invoice/:invoiceId/finalize - Finalize an invoice
router.put('/invoice/:invoiceId/finalize', protect, invoiceController.finalizeInvoice);

// POST /stripe/invoice/:invoiceId/pay - Pay an invoice
router.post('/invoice/:invoiceId/pay', protect, invoiceController.payInvoice);

const { stripe } = require("../server");
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

router.post("/webhook", express.raw({ type: 'application/json' }), (request, response) => {
  const sig = request.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
  } catch (err) {
    console.log(`⚠️ Webhook signature error: ${err.message}`);
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the checkout.session.completed event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const email = session.customer_email;
    const courseId = session.metadata.course_id;

    console.log(`✅ Payment complete. Grant access to ${email} for course ${courseId}`);

    // 👉 Call your custom WordPress endpoint here to give access
    giveUserAccessToTutorLMS(email, courseId);
  }

  response.status(200).send("Received");
});

module.exports = router;