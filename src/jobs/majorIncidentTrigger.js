/**
 * Major incident trigger engine.
 * Evaluates incidents for major incident candidacy based on severity/impact thresholds.
 * Runs every 10 minutes.
 */
const Incident = require("../models/helpdesk/incidents/Incident");
const MajorIncidentCandidate = require("../models/helpdesk/incidents/MajorIncidentCandidate");
const MajorIncident = require("../models/helpdesk/incidents/MajorIncident");
const events = require("../services/events");

const AUTO_NOMINATE_SEVERITIES = ["Sev1"];
const BATCH_SIZE = 50;

async function evaluateMajorIncidentTriggers() {
  const candidates = await MajorIncidentCandidate.find({
    status: "pending",
  }).populate("incident");
  const declaredIncidents = await MajorIncident.find({
    status: "declared",
  }).select("incident");
  const declaredIncidentIds = new Set(
    declaredIncidents.map((mi) => String(mi.incident)),
  );

  const candidatesToEvaluate = candidates.filter(
    (c) => !declaredIncidentIds.has(String(c.incident?._id)),
  );
  const newCandidates = 0;
  let promoted = 0;

  for (const candidate of candidatesToEvaluate) {
    if (!candidate.incident) continue;
    const incident = candidate.incident;

    if (
      AUTO_NOMINATE_SEVERITIES.includes(incident.severity) &&
      incident.status === "investigating"
    ) {
      try {
        await MajorIncidentCandidate.findByIdAndUpdate(candidate._id, {
          status: "approved",
          reviewedAt: new Date(),
        });

        const majorIncident = await MajorIncident.findOneAndUpdate(
          { incident: incident._id },
          {
            status: "declared",
            declaredAt: new Date(),
          },
          { upsert: true, new: true },
        );

        await Incident.findByIdAndUpdate(incident._id, { isMajor: true });

        events.emit("incident.created", {
          incidentId: incident._id,
          tenantId: incident.company,
          isMajor: true,
        });

        promoted++;
      } catch (err) {
        console.error(
          `[majorTrigger] Failed for candidate ${candidate._id}:`,
          err.message,
        );
      }
    }
  }

  return { evaluated: candidatesToEvaluate.length, promoted };
}

module.exports = { evaluateMajorIncidentTriggers };
