const axios = require('axios');
const { EVENT_NAMES, bus } = require('./events');

let cache = null;
let cacheAt = 0;
const CACHE_TTL = 30000;

// Integrations that can deliver webhook-style payloads:
// categories messaging/automation/other with either `config.webhookUrl` or a
// `webhook` sub-config. Subscribe to the events listed in `integration.events`
// (empty array = all events).
async function loadTargets() {
  if (cache && Date.now() - cacheAt < CACHE_TTL) return cache;
  const Integration = require('../models/Integration');
  cache = await Integration.find({ isEnabled: true }).lean();
  cacheAt = Date.now();
  return cache;
}

function payloadFor(eventName, data) {
  return {
    event: eventName,
    timestamp: new Date().toISOString(),
    payload: data || {},
  };
}

async function deliver(integration, eventName, data) {
  const cfg = integration.config || {};
  const url = cfg.webhookUrl || (cfg.webhook && cfg.webhook.url);
  if (!url || !/^https?:\/\//.test(url)) return;
  const secret = cfg.secret || (cfg.webhook && cfg.webhook.secret) || '';
  const headers = { 'Content-Type': 'application/json', 'User-Agent': 'osTicket-Integration/1.0' };
  if (secret) headers['X-Ost-Signature'] = secret;
  const id = integration._id;
  const status = await axios.post(url, payloadFor(eventName, data), {
    headers,
    timeout: 8000,
  }).then((r) => String(r.status)).catch((e) => `error:${e.message || 'delivery failed'}`);
  try {
    const Integration = require('../models/Integration');
    await Integration.updateOne(
      { _id: id },
      {
        $set: { lastDeliveryAt: new Date(), lastStatus: status },
        $push: {
          deliveryLogs: {
            $each: [{ at: new Date(), status, event: eventName, response: String(status).slice(0, 300) }],
            $slice: -50,
          },
        },
        $inc: { failureCount: status.startsWith('2') ? 0 : 1 },
      }
    );
  } catch (err) {
    // logging failures must never break dispatch
  }
}

function subscribe() {
  for (const eventName of EVENT_NAMES) {
    bus.on(eventName, async (data) => {
      try {
        const targets = await loadTargets();
        const company = data?.company || null;
        for (const integration of targets) {
          const events = integration.events || [];
          if (events.length && !events.includes(eventName)) continue;
          if (company && integration.company && String(integration.company) !== String(company)) continue;
          await deliver(integration, eventName, data);
        }
      } catch (err) {
        // never block the bus
      }
    });
  }
}

subscribe();

module.exports = { subscribe, loadTargets };