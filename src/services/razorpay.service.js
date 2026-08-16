const Razorpay = require('razorpay');
const crypto = require('crypto');
const config = require('../config/config');

let instance = null;
const getInstance = () => {
  if (instance) return instance;
  if (!config.razorpay.keyId || !config.razorpay.keySecret) {
    throw new Error('Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)');
  }
  instance = new Razorpay({
    key_id: config.razorpay.keyId,
    key_secret: config.razorpay.keySecret,
  });
  return instance;
};

exports.createOrder = async ({ amount, currency = 'INR', receipt, notes = {} }) => {
  const order = await getInstance().orders.create({
    amount: Math.round(amount * 100),
    currency,
    receipt: receipt || `rcpt_${Date.now()}`,
    notes,
  });
  return order;
};

exports.verifyPayment = ({ orderId, paymentId, signature }) => {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac('sha256', config.razorpay.keySecret)
    .update(body)
    .digest('hex');
  return expected === signature;
};

exports.verifyWebhookSignature = (body, signature) => {
  const expected = crypto
    .createHmac('sha256', config.razorpay.webhookSecret)
    .update(body)
    .digest('hex');
  return expected === signature;
};

exports.fetchPayment = (paymentId) => getInstance().payments.fetch(paymentId);

exports.refundPayment = (paymentId, amount) =>
  getInstance().payments.refund(paymentId, { amount: Math.round(amount * 100) });

