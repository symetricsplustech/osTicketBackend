const ApiError = require('../utils/ApiError');
const { authorize } = require('./authorization.service');
const { auditRequired } = require('./audit.service');

async function authorizeAgentCommand({ req, permission, resource = {}, record = null }) {
  if (!req.agent || !req.companyId) throw new ApiError(403, 'Agent tenant access required');
  const result = await authorize({ principal: req.agent, permission, tenant: req.companyId, resource, record, req });
  if (result.decision !== 'ALLOW') throw new ApiError(403, 'You do not have permission for this action');
  return result;
}

async function auditAgentCommand({ req, action, entityType, entityId, before = null, after = null, reason = '' }) {
  return auditRequired({
    company: req.companyId,
    actorType: 'agent',
    actor: req.agent._id,
    actorName: req.agent.name,
    action,
    entityType,
    entityId,
    before,
    after,
    reason,
    req,
  });
}

module.exports = { authorizeAgentCommand, auditAgentCommand };
