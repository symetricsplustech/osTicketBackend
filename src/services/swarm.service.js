const Incident = require('../models/helpdesk/incidents/Incident');
const Team = require('../models/Team');

async function escalateToSwarm({ company, incidentId, requesterId, message }) {
  const incident = await Incident.findOne({ _id: incidentId, company }).lean();
  if (!incident) throw new Error('Incident not found');

  let agentIds = [];
  if (incident.team) {
    const team = await Team.findById(incident.team).lean();
    if (team && team.members) agentIds = team.members;
  }

  if (!agentIds.length) {
    const team = await Team.findOne({ company }).sort({ createdAt: 1 }).lean();
    if (team && team.members) agentIds = team.members;
  }

  const calloutMessage =
    message || `⚠️ Swarm callout for incident ${incident.number || incident.title}`;

  const update = {
    user: requesterId,
    activity: `[swarm callout] ${calloutMessage}`,
    status: 'swarm',
    message: calloutMessage,
    at: new Date(),
  };

  await Incident.collection.updateOne(
    { _id: incident._id },
    { $push: { updates: update } }
  );

  return { incidentId: incident._id, calloutMessage, notifiedAgents: agentIds };
}

async function logSwarmActivity({ company, incidentId, userId, activity }) {
  const incident = await Incident.findOne({ _id: incidentId, company }).lean();
  if (!incident) throw new Error('Incident not found');

  const entry = { user: userId, activity, at: new Date() };
  await Incident.collection.updateOne(
    { _id: incident._id },
    { $push: { updates: entry } }
  );
  return { incidentId, logged: true };
}

module.exports = { escalateToSwarm, logSwarmActivity };
