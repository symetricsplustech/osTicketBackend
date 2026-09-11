/**
 * SLA escalation engine for incidents.
 * Evaluates escalation rules and fires tiered actions.
 * Runs every 5 minutes.
 */
const Incident = require('../models/helpdesk/incidents/Incident');
const EscalationRule = require('../models/helpdesk/incidents/EscalationRule');
const events = require('../services/events');
const auditEventService = require('../services/auditEventService');

const BATCH_SIZE = 100;

async function evaluateIncidentEscalations() {
  const rules = await EscalationRule.find({ isActive: true });
  if (!rules.length) return { evaluated: 0, fired: 0 };

  const activeIncidents = await Incident.find({
    status: { $nin: ['resolved', 'closed', 'canceled'] },
    isActive: true,
  }).limit(BATCH_SIZE);

  let fired = 0;

  for (const incident of activeIncidents) {
    const incidentAge = Math.floor((Date.now() - incident.createdAt.getTime()) / 60000);

    for (const rule of rules) {
      if (!rule.statuses.includes(incident.status)) continue;

      for (const tier of rule.tiers) {
        if (incidentAge < tier.afterMinutes) continue;

        const tierKey = `escalation_fired_${rule._id}_${tier.afterMinutes}`;
        if (incident[tierKey]) continue;

        try {
          if (tier.raisePriorityTo) {
            incident.priority = tier.raisePriorityTo;
          }
          if (tier.setStatus) {
            incident.status = tier.setStatus;
          }
          if (tier.reassignAgent) {
            incident.assignedTo = tier.reassignAgent;
          }
          if (tier.reassignTeam) {
            incident.assignmentGroup = tier.reassignTeam;
          }

          incident[tierKey] = true;
          incident.timeline.push({
            at: new Date(),
            by: 'system',
            message: `Escalation rule '${rule.name}' tier ${tier.afterMinutes}min fired`,
          });

          await incident.save();

          await auditEventService.record({
            tenantId: incident.company,
            actorId: null,
            action: 'incident.escalated',
            resourceType: 'Incident',
            resourceId: incident._id,
            after: incident.toObject(),
          });

          events.emit('incident.updated', { incidentId: incident._id, tenantId: incident.company });
          fired++;
        } catch (err) {
          console.error(`[escalation] Failed to escalate incident ${incident._id}:`, err.message);
        }
      }
    }
  }

  return { evaluated: activeIncidents.length, fired };
}

module.exports = { evaluateIncidentEscalations };
