const subscriptionService = require('../services/subscriptionService');
const User = require('../models/User');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.createSubscription = async (req, res) => {
  try {
    const { userId, email, planId, autoRenew, paymentMethod, courseId, stripe_payment_id } = req.body;

    if (!userId || !email || !planId || !stripe_payment_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const subscriptionData = {
      UserID: userId,
      email,
      stripe_payment_id,
      plan_id: planId,
      auto_renew: autoRenew !== undefined ? autoRenew : true,
      payment_method: paymentMethod || 'card',
      Solution_id: courseId || null
    };

    const result = await subscriptionService.createSubscription(subscriptionData);

    res.status(201).json({
      message: 'Subscription created successfully',
      subscription: result.subscription,
      client_secret: result.client_secret
    });
  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getSubscriptionStatus = async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ error: 'Subscription ID is required' });
    }

    const result = await subscriptionService.updateSubscriptionStatus(subscriptionId);

    res.status(200).json({
      message: 'Subscription status updated',
      subscription: result.subscription,
      stripeSubscription: result.stripeSubscription
    });
  } catch (error) {
    console.error('Get subscription status error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ error: 'Subscription ID is required' });
    }

    const result = await subscriptionService.cancelSubscription(subscriptionId);

    res.status(200).json({
      message: 'Subscription cancelled successfully',
      subscription: result.subscription,
      canceledSubscription: result.canceledSubscription
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: error.message });
  }
};




exports.syncSubscriptions = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await subscriptionService.syncSubscriptions(email);

    res.status(200).json({
      message: 'Subscriptions synced successfully',
      updated: result.updated,
      created: result.created
    });
  } catch (error) {
    console.error('Sync subscriptions error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getUserSubscriptions = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const subscriptions = await subscriptionService.getUserSubscriptions(userId);

    res.status(200).json({
      message: 'User subscriptions retrieved successfully',
      subscriptions
    });
  } catch (error) {
    console.error('Get user subscriptions error:', error);
    res.status(500).json({ error: error.message });
  }
};

// New method to get subscription from session ID
exports.getSubscriptionFromSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    const session = await stripe.checkout.sessions.retrieve(
      sessionId,
      { expand: ['subscription'] }
    );
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (!session.subscription) {
      return res.status(202).json({ 
        message: 'Subscription not yet available. Payment may still be processing.',
        sessionStatus: session.status,
        paymentStatus: session.payment_status
      });
    }
    
    // Optionally sync this subscription to your database
    if (session.customer && session.subscription) {
      try {
        const customer = await stripe.customers.retrieve(session.customer);
        
        if (customer && customer.email) {
          // Try to find user by email
          const user = await User.findOne({ email: customer.email });
          
          if (user) {
            // Create a subscription record in your database
            await subscriptionService.syncSubscriptionFromStripe(
              session.subscription.id, 
              user._id, 
              customer.email
            );
          }
        }
      } catch (syncError) {
        console.error('Error syncing subscription:', syncError);
        // Continue - we can still return subscription info
      }
    }
    
    res.json({
      subscription: session.subscription,
      sessionStatus: session.status
    });
    
  } catch (error) {
    console.error('Error retrieving subscription from session:', error);
    res.status(500).json({ error: error.message });
  }
};