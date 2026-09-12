/**
 * Auto-close resolved incidents after configurable grace period.
 * Runs every 15 minutes.
 */
const Incident = require("../models/helpdesk/incidents/Incident");
const IncidentResolution = require("../models/helpdesk/incidents/IncidentResolution");
const events = require("../services/events");
const auditEventService = require("../services/auditEventService");

const GRACE_PERIOD_HOURS = 72;
const BATCH_SIZE = 50;

async function autoCloseResolvedIncidents() {
  const cutoff = new Date(Date.now() - GRACE_PERIOD_HOURS * 60 * 60 * 1000);

  const incidents = await Incident.find({
    status: "resolved",
    resolvedAt: { $lte: cutoff },
    isActive: true,
  }).limit(BATCH_SIZE);

  let closed = 0;
  for (const incident of incidents) {
    try {
      const before = incident.toObject();
      incident.status = "closed";
      incident.closedAt = new Date();
      incident.timeline.push({
        at: new Date(),
        by: "system",
        message: "Auto-closed after grace period",
      });
      await incident.save();

      await IncidentResolution.findOneAndUpdate(
        { incident: incident._id },
        { isAutoClosed: true, confirmedByUser: false },
      );

      await auditEventService.record({
        tenantId: incident.company,
        actorId: null,
        action: "incident.auto_closed",
        resourceType: "Incident",
        resourceId: incident._id,
        before,
        after: incident.toObject(),
      });

      events.emit("status.incident", {
        incidentId: incident._id,
        tenantId: incident.company,
        from: "resolved",
        to: "closed",
      });

      closed++;
    } catch (err) {
      console.error(
        `[autoClose] Failed to close incident ${incident._id}:`,
        err.message,
      );
    }
  }

  return { processed: incidents.length, closed };
}

module.exports = { autoCloseResolvedIncidents };
