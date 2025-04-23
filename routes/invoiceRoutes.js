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

router.post('/webhook', async (req, res) => {
  const event = req.body;

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Step 1: Get JWT
    const token = await getJwtToken();

    // Step 2: Create or fetch WordPress user
    const email = session.customer_email;
    const username = email.split('@')[0];
    const wpUser = await findOrCreateUser(token, {
      username,
      email,
      password: 'user@123',
      roles: ['subscriber']
    });

    // Step 3: Determine Enrollment Type
    let courseData = session.metadata || stripeToCourseMap[session.line_items[0].price.id];

    if (!courseData) return res.status(400).send({ error: 'Course info not found' });

    // Step 4: Enroll user in course or bundle
    await enrollUserInCourse(token, wpUser.id, courseData.course_id, courseData.tag_id);

    res.status(200).send({ success: true });
  } else {
    res.status(400).send({ message: 'Event not handled' });
  }
});

module.exports = router;