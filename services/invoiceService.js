require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const invoiceRepository = require('../repositories/invoiceRepository');
const userRepository = require('../repositories/userRepository'); // You need to create this

class InvoiceService {
  async generateInvoice(invoiceData) {
    try {
      const { UserID, email, plan_id, amount_due, Currency = 'USD', Sub_type, Solution_id } = invoiceData;

      // Get stripe customer ID from user
      const user = await userRepository.getUserByEmail(email);
      if (!user || !user.stripe_customer_id) {
        throw new Error('User not found or missing Stripe customer ID');
      }

      // Create an invoice item in Stripe
      const invoiceItem = await stripe.invoiceItems.create({
        customer: user.stripe_customer_id,
        amount: amount_due, // amount in cents
        currency: Currency.toLowerCase(),
        description: `Payment for ${plan_id} plan` + (Solution_id ? ` - Solution ID: ${Solution_id}` : '')
      });

      // Create the invoice in Stripe
      const stripeInvoice = await stripe.invoices.create({
        customer: user.stripe_customer_id,
        auto_advance: true, // auto-finalize the invoice
        collection_method: 'charge_automatically',
        description: `Invoice for ${plan_id} plan - ${Sub_type === 'RECUR' ? 'Recurring' : 'One-time'} payment`
      });

      // Calculate due date (typically 30 days from now)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      // Create invoice record in MongoDB
      const invoice = await invoiceRepository.createInvoice({
        UserID,
        email,
        plan_id,
        stripe_invoice_id: stripeInvoice.id,
        Solution_id: Solution_id || null,
        Sub_type,
        amount_due,
        Currency,
        Status: stripeInvoice.status,
        due_date: dueDate,
        receipt_url: null // As requested, keeping it null for now
      });

      return {
        invoice,
        stripeInvoice
      };
    } catch (error) {
      throw new Error(`Failed to generate invoice: ${error.message}`);
    }
  }

  async finalizeInvoice(invoiceId) {
    try {
      const invoice = await invoiceRepository.getInvoiceById(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Finalize the invoice in Stripe
      const stripeInvoice = await stripe.invoices.finalizeInvoice(invoice.stripe_invoice_id);
      
      // Update the local invoice
      await invoiceRepository.updateInvoice(invoiceId, {
        Status: stripeInvoice.status
      });

      return stripeInvoice;
    } catch (error) {
      throw new Error(`Failed to finalize invoice: ${error.message}`);
    }
  }

  async payInvoice(invoiceId) {
    try {
      const invoice = await invoiceRepository.getInvoiceById(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Pay the invoice in Stripe
      const stripeInvoice = await stripe.invoices.pay(invoice.stripe_invoice_id);
      
      // Update the local invoice
      await invoiceRepository.updateInvoice(invoiceId, {
        Status: stripeInvoice.status,
        receipt_url: stripeInvoice.hosted_invoice_url || null
      });

      return stripeInvoice;
    } catch (error) {
      throw new Error(`Failed to pay invoice: ${error.message}`);
    }
  }

  async getInvoiceDetails(invoiceId) {
    try {
      const invoice = await invoiceRepository.getInvoiceById(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Get additional details from Stripe if needed
      const stripeInvoice = await stripe.invoices.retrieve(invoice.stripe_invoice_id);
      
      return {
        invoice,
        stripeDetails: stripeInvoice
      };
    } catch (error) {
      throw new Error(`Failed to get invoice details: ${error.message}`);
    }
  }

  async getUserInvoices(userId) {
    try {
      return await invoiceRepository.getInvoicesByUserId(userId);
    } catch (error) {
      throw new Error(`Failed to get user invoices: ${error.message}`);
    }
  }
}

module.exports = new InvoiceService();