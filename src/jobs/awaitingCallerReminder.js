/**
 * Send reminders for incidents in on_hold_caller state.
 * Runs every 30 minutes.
 */
const Incident = require('../models/helpdesk/incidents/Incident');
const events = require('../services/events');

const REMINDER_INTERVAL_HOURS = 4;
const BATCH_SIZE = 100;

async function checkAwaitingCallerReminders() {
  const cutoff = new Date(Date.now() - REMINDER_INTERVAL_HOURS * 60 * 60 * 1000);

  const incidents = await Incident.find({
    status: 'on_hold_caller',
    isActive: true,
    updatedAt: { $lte: cutoff },
  }).limit(BATCH_SIZE);

  let notified = 0;

  for (const incident of incidents) {
    try {
      events.emit('notification.awaiting_caller', {
        incidentId: incident._id,
        tenantId: incident.company,
        assignedTo: incident.assignedTo,
        assignmentGroup: incident.assignmentGroup,
        number: incident.number,
        title: incident.title,
        holdReason: incident.holdReason,
        lastUpdate: incident.updatedAt,
      });

      notified++;
    } catch (err) {
      console.error(`[awaitingCaller] Failed for incident ${incident._id}:`, err.message);
    }
  }

  return { evaluated: incidents.length, notified };
}

module.exports = { checkAwaitingCallerReminders };
