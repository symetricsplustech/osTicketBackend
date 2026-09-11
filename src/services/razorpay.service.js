const config = require('../config/config');

let client = null;
if (config.razorpay.enabled) {
  const Razorpay = require('razorpay');
  client = new Razorpay({ key_id: config.razorpay.keyId, key_secret: config.razorpay.keySecret });
}

function unavailable() {
  throw new Error('Razorpay is not configured');
}

module.exports = {
  enabled: Boolean(client),
  orders: client ? client.orders : { create: unavailable },
  payments: client ? client.payments : {},
  instance: client,
};
