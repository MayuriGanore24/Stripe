const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');

class InvoiceRepository {
  async createInvoice(invoiceData) {
    try {
      const invoice = new Invoice({
        _id: new mongoose.Types.ObjectId(),
        ...invoiceData
      });
      return await invoice.save();
    } catch (error) {
      throw new Error(`Failed to create invoice: ${error.message}`);
    }
  }

  async getInvoiceById(id) {
    try {
      return await Invoice.findById(id);
    } catch (error) {
      throw new Error(`Failed to get invoice: ${error.message}`);
    }
  }

  async getInvoiceByStripeId(stripeInvoiceId) {
    try {
      return await Invoice.findOne({ stripe_invoice_id: stripeInvoiceId });
    } catch (error) {
      throw new Error(`Failed to get invoice by Stripe ID: ${error.message}`);
    }
  }

  async updateInvoice(id, updateData) {
    try {
      return await Invoice.findByIdAndUpdate(
        id,
        { 
          ...updateData,
          updated_at: Date.now()
        },
        { new: true }
      );
    } catch (error) {
      throw new Error(`Failed to update invoice: ${error.message}`);
    }
  }

  async getInvoicesByUserId(userId) {
    try {
      return await Invoice.find({ UserID: userId }).sort({ created_at: -1 });
    } catch (error) {
      throw new Error(`Failed to get user invoices: ${error.message}`);
    }
  }
}

module.exports = new InvoiceRepository();