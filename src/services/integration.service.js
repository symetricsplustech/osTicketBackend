const { bus } = require('./events');
const logger = require('../utils/logger');

let initialized = false;
function initializeIntegrations() {
  if (initialized) return;
  initialized = true;
  bus.on('webhook.dispatched', (event) => logger.debug(`Webhook delivery: ${JSON.stringify(event)}`));
}

initializeIntegrations();
module.exports = { initializeIntegrations };
