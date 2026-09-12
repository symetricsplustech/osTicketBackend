const { EventEmitter } = require("events");
const crypto = require("crypto");

const bus = new EventEmitter();
bus.setMaxListeners(100);

// Canonical platform events (also the developer-platform webhook event catalog)
const EVENT_NAMES = [
  "ticket.created",
  "ticket.updated",
  "ticket.assigned",
  "ticket.claimed",
  "ticket.transferred",
  "ticket.replied",
  "ticket.note_added",
  "ticket.status_changed",
  "ticket.priority_changed",
  "ticket.overdue",
  "ticket.escalated",
  "ticket.resolved",
  "ticket.closed",
  "ticket.reopened",
  "customer.replied",
  "customer.created",
  "task.completed",
  "agent.status_changed",
  "sla.breached",
  "sla.at_risk",
  "sla.paused",
  "sla.resumed",
  "approval.created",
  "approval.completed",
  "approval.rejected",
  "incident.created",
  "incident.updated",
  "incident.resolved",
  "problem.created",
  "change.created",
  "change.approved",
  "chat.message",
  "chat.conversation_created",
  "call.completed",
  "csat.submitted",
  "status.incident",
  "survey.sent",
  "webhook.dispatched",
];

// Simple in-process webhook dispatch (bounded, non-blocking)
let webhookCache = null;
let webhookCacheAt = 0;

const signPayload = (secret, body) =>
  crypto
    .createHmac("sha256", secret || "")
    .update(body)
    .digest("hex");

/**
 * Per-target payload formats (§37): generic JSON keeps the full envelope;
 * slack/teams targets receive the plain-text card their incoming webhooks
 * expect, so the same ticket events fan out to chat tools.
 */
function formatWebhookBody(target, eventName, payload = {}) {
  if (target.format !== "slack" && target.format !== "teams") {
    return {
      body: JSON.stringify({
        event: eventName,
        data: payload,
        sentAt: new Date().toISOString(),
      }),
      contentType: "application/json",
    };
  }
  const d = payload || {};
  const label = String(eventName)
    .replace(/^ticket\./, "Ticket ")
    .replace(/_/g, " ");
  const bits = [label];
  if (d.ticketNumber) bits.push(`#${d.ticketNumber}`);
  if (d.subject) bits.push(`— ${d.subject}`);
  else if (d.message) bits.push(`— ${String(d.message).slice(0, 140)}`);
  const text = `osTicket: ${bits.join(" ")}`;
  return { body: JSON.stringify({ text }), contentType: "application/json" };
}

async function dispatchWebhooks(eventName, payload) {
  try {
    const company = payload && payload.company ? payload.company : null;
    if (!company) return;
    if (!webhookCache || Date.now() - webhookCacheAt > 30000) {
      const Webhook = require("../models/Webhook");
      webhookCache = await Webhook.find({ isActive: true }).lean();
      webhookCacheAt = Date.now();
    }
    const targets = webhookCache.filter(
      (w) =>
        w.events.includes(eventName) && String(w.company) === String(company),
    );
    if (!targets.length) return;
    for (const target of targets) {
      const { body, contentType } = formatWebhookBody(
        target,
        eventName,
        payload,
      );
      const headers = { "Content-Type": contentType };
      if (target.secret)
        headers["X-OsTicket-Signature"] = signPayload(target.secret, body);
      try {
        const res = await fetch(target.url, {
          method: "POST",
          headers,
          body,
          signal: AbortSignal.timeout(10000),
        });
        const status = res.ok ? "delivered" : `failed:${res.status}`;
        const Webhook = require("../models/Webhook");
        await Webhook.updateOne(
          { _id: target._id },
          {
            $set: {
              lastDeliveryAt: new Date(),
              lastStatus: status,
              failureCount: res.ok ? 0 : (target.failureCount || 0) + 1,
            },
            $push: {
              deliveryLogs: {
                $each: [
                  {
                    at: new Date(),
                    status,
                    response: (await res.text()).slice(0, 200),
                  },
                ],
                $slice: -20,
              },
            },
          },
        );
        bus.emit("webhook.dispatched", { webhookId: target._id, status });
      } catch (err) {
        const Webhook = require("../models/Webhook");
        await Webhook.updateOne(
          { _id: target._id },
          {
            $set: {
              lastDeliveryAt: new Date(),
              lastStatus: `error:${err.message.slice(0, 80)}`,
              failureCount: (target.failureCount || 0) + 1,
            },
            $push: {
              deliveryLogs: {
                $each: [
                  {
                    at: new Date(),
                    status: "error",
                    response: err.message.slice(0, 200),
                  },
                ],
                $slice: -20,
              },
            },
          },
        );
      }
    }
  } catch (err) {
    // never throw from the event bus
  }
}

/**
 * emit(eventName, payload) — canonical entry point for all platform events.
 * Synchronously notifies in-process listeners (workflows, realtime, audit)
 * and asynchronously dispatches company webhooks.
 */
function emit(eventName, payload = {}) {
  try {
    bus.emit(eventName, payload);
    bus.emit("*", eventName, payload);
  } catch (err) {
    // listener errors must not crash the caller
  }
  dispatchWebhooks(eventName, payload).catch(() => {});
}

module.exports = { bus, emit, EVENT_NAMES, signPayload };
