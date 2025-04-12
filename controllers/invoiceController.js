const invoiceService = require('../services/invoiceService');
const asyncHandler = require('../middleware/asyncHandler');

// Generate Invoice
exports.generateInvoice = asyncHandler(async (req, res) => {
    const { UserID, email, plan_id, amount_due, Currency, Sub_type, Solution_id } = req.body;

    // Validate required fields
    if (!UserID || !email || !plan_id || !amount_due || !Sub_type) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Validate plan-specific fields
    if ((plan_id === 'PPC' || plan_id === 'FlexPicks') && !Solution_id) {
        return res.status(400).json({ success: false, message: 'Solution_id is required for PPC or FlexPicks plans' });
    }

    const result = await invoiceService.generateInvoice({ UserID, email, plan_id, amount_due, Currency, Sub_type, Solution_id });

    res.status(201).json({ success: true, data: result });
});

// Finalize Invoice
exports.finalizeInvoice = asyncHandler(async (req, res) => {
    const { invoiceId } = req.params;
    const stripeInvoice = await invoiceService.finalizeInvoice(invoiceId);
    res.status(200).json({ success: true, data: stripeInvoice });
});

// Pay Invoice
exports.payInvoice = asyncHandler(async (req, res) => {
    const { invoiceId } = req.params;
    const stripeInvoice = await invoiceService.payInvoice(invoiceId);
    res.status(200).json({ success: true, data: stripeInvoice });
});

// Get Invoice Details
exports.getInvoiceDetails = asyncHandler(async (req, res) => {
    const { invoiceId } = req.params;
    const invoiceDetails = await invoiceService.getInvoiceDetails(invoiceId);
    res.status(200).json({ success: true, data: invoiceDetails });
});

// Get User Invoices
exports.getUserInvoices = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const invoices = await invoiceService.getUserInvoices(userId);
    res.status(200).json({ success: true, data: invoices });
});
