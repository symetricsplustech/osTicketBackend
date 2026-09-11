const P6 = require('../models/platformData');
const Incident = require('../models/helpdesk/incidents/Incident');
const { auditRequired } = require('./audit.service');
const { notifyAgent } = require('./notification.service');

// Claims each due plan by matching its previous deadline. This makes the
// runner safe when more than one API process evaluates the same cadence.
async function processDueCommunicationPlans({ now = new Date(), limit = 50 } = {}) {
  const candidates = await P6.CommunicationPlan.find({ nextUpdateAt: { $lte: now } })
    .sort({ nextUpdateAt: 1 })
    .limit(Math.min(Math.max(Number(limit) || 50, 1), 200));
  const processed = [];

  for (const plan of candidates) {
    const incident = await Incident.findOne({ _id: plan.incident, company: plan.tenantId });
    if (!incident || !incident.isMajor || ['resolved', 'closed'].includes(incident.status)) {
      // A stale plan must not be repeatedly re-claimed by every scheduler run.
      await P6.CommunicationPlan.deleteOne({ _id: plan._id, nextUpdateAt: plan.nextUpdateAt });
      continue;
    }
    const cadenceMinutes = Number(plan.cadenceMinutes);
    if (!Number.isInteger(cadenceMinutes) || cadenceMinutes < 15 || cadenceMinutes > 1440) continue;
    const nextUpdateAt = new Date(now.getTime() + cadenceMinutes * 60000);
    const claimed = await P6.CommunicationPlan.findOneAndUpdate(
      { _id: plan._id, nextUpdateAt: plan.nextUpdateAt },
      { $set: { nextUpdateAt }, $inc: { updatesSent: 1 } },
      { new: true },
    );
    if (!claimed) continue;

    await auditRequired({
      company: plan.tenantId,
      actorType: 'system',
      actorName: 'Major incident communication scheduler',
      action: 'incident.communication_due',
      entityType: 'incident',
      entityId: incident._id,
      before: { nextUpdateAt: plan.nextUpdateAt, updatesSent: plan.updatesSent },
      after: { nextUpdateAt: claimed.nextUpdateAt, updatesSent: claimed.updatesSent, audience: claimed.audience },
      reason: 'Scheduled major-incident communication is due',
      source: 'scheduler',
    });
    await notifyAgent({
      agentId: incident.commander,
      company: plan.tenantId,
      type: 'major_incident_communication_due',
      message: `Communication update is due for major incident ${incident.number}.`,
      link: `/incidents/${incident._id}`,
    });
    processed.push({ incidentId: String(incident._id), planId: String(claimed._id), audience: claimed.audience, nextUpdateAt });
  }
  return { processed, count: processed.length };
}

const scheduleMajorIncidentCommunicationCheck = () => setInterval(
  () => processDueCommunicationPlans().catch(() => {}),
  60 * 1000,
);

module.exports = { processDueCommunicationPlans, scheduleMajorIncidentCommunicationCheck };
