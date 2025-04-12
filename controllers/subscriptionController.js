const subscriptionService = require('../services/subscriptionService');
const User = require('../models/User');

exports.createSubscription = async (req, res) => {
  try {
    const { userId, email, planId, autoRenew, paymentMethod, courseId } = req.body;

    if (!userId || !email || !planId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const subscriptionData = {
      UserID: userId,
      email,
      stripe_payment_id: req.body.stripePaymentId || 'pending',
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