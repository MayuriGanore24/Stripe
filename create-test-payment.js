// Save this as a separate test script (create-test-payment.js)
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function createTestPaymentMethod() {
    try {
        // Create a test payment method
        const paymentMethod = await stripe.paymentMethods.create({
            type: 'card',
            card: { token: 'tok_visa' },
        });

        console.log('Created test payment method:');
        console.log(`Payment Method ID: ${paymentMethod.id}`);
        return paymentMethod.id;
    } catch (error) {
        console.error('Error creating payment method:', error);
    }
}

createTestPaymentMethod();