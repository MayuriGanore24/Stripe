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

module.exports = router;