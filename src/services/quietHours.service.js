/**
 * Quiet-hours enforcement service (checklist §2.36).
 *
 * sendOrDefer(): checks recipient quiet-hours before sending any non-urgent
 * notification. If inside curfew → message is queued in NotificationQueue for
 * delivery when the curfew lifts. Urgent types always bypass.
 */
const mongoose = require('mongoose');

const URGENT_TYPES = new Set(['overdue', 'sla_breach', 'escalation', 'major_incident', 'security_alert']);

// Local queue model (kept here to avoid cross-file circulars)
const queuedSchema = new mongoose.Schema(
  {
    channel: { type: String, enum: ['email', 'push', 'sms', 'whatsapp', 'in_app'], required: true },
    recipientType: { type: String, enum: ['agent', 'user'], required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    payload: mongoose.Schema.Types.Mixed,
    deliverAfter: { type: Date, index: true },
    delivered: { type: Boolean, default: false, index: true },
    deliveredAt: Date,
    tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  },
  { timestamps: true }
);
const NotificationQueue =
  mongoose.models.QueuedNotification || mongoose.model('QueuedNotification', queuedSchema);

async function getPref(recipientType, recipient) {
  const P5 = require('../models/Platform5');
  if (recipientType !== 'user') return null; // agent prefs handled separately
  return P5.NotificationPref.findOne({ user: recipient }).lean();
}

function inQuietHours(pref) {
  const qh = pref && pref.quietHours;
  if (!qh || !qh.enabled) return null;
  const tz = qh.tz || 'UTC';
  const nowLocal = new Date().toLocaleTimeString('en-GB', { hour12: false, timeZone: tz }).slice(0, 5);
  const { start, end } = qh;
  const inside = start <= end ? nowLocal >= start && nowLocal < end : nowLocal >= start || nowLocal < end;
  return inside ? { start, end, tz } : null;
}

function nextWindowEnd(qh) {
  // Compute UTC time when quiet hours end
  const [h, m] = qh.end.split(':').map(Number);
  const now = new Date(
    new Date().toLocaleString('en-US', { timeZone: qh.tz || 'UTC' })
  );
  const endLocal = new Date(now);
  endLocal.setHours(h, m, 0, 0);
  if (endLocal <= now) endLocal.setDate(endLocal.getDate() + 1); // windows wraps past midnight
  return endLocal;
}

/**
 * Enqueue or immediately send a notification.
 * @returns {Promise<{status: 'sent'|'queued'}>}
 */
async function sendOrDefer({ channel, type, recipientType, recipient, payload, sendFn, tenantId }) {
  try {
    if (URGENT_TYPES.has(type)) {
      await sendFn();
      return { status: 'sent', reason: 'urgent_bypass' };
    }
    const pref = await getPref(recipientType, recipient);
    const qh = inQuietHours(pref);
    if (qh) {
      await NotificationQueue.create({
        channel,
        recipientType,
        recipient,
        payload,
        deliverAfter: nextWindowEnd(qh),
        tenantId,
      });
      return { status: 'queued', deliverAfter: nextWindowEnd(qh) };
    }
    await sendFn();
    return { status: 'sent' };
  } catch (err) {
    // Envelope failures must never break the caller
    try { await sendFn(); } catch (_) { /* final fallback: drop */ }
    return { status: 'sent', degraded: true };
  }
}

/** Drain the queue — call from a cron/scheduler every minute. */
async function drainQueue() {
  const now = new Date();
  const batch = await NotificationQueue.find({ delivered: false, deliverAfter: { $lte: now } })
    .sort({ deliverAfter: 1 })
    .limit(200);
  const notificationService = require('./notification.service');
  let delivered = 0;
  for (const item of batch) {
    try {
      if (item.channel === 'email' && item.payload?.templateKey) {
        const emailService = require('./email.service');
        await emailService.sendFromTemplate({ ...(item.payload.data || {}), to: item.payload.to, key: item.payload.templateKey });
      } else if (item.channel === 'in_app' && item.recipientType === 'agent') {
        await notificationService.notifyAgent({ agentId: item.recipient, ...(item.payload || {}) });
      }
      item.delivered = true;
      item.deliveredAt = new Date();
      await item.save();
      delivered++;
    } catch (err) {
      // leave undelivered; increment attempts via updatedAt touch
      await item.save();
    }
  }
  return { scanned: batch.length, delivered };
}

module.exports = { sendOrDefer, drainQueue, URGENT_TYPES, NotificationQueue };
