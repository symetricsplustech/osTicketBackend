const service = require('./auditEvent.service');

function log({ tenantId, actorId, entityType, entityId, action, before, after, ...rest }) {
  return service.record({
    tenantId,
    actor: actorId,
    entityType,
    entityId,
    action: 'transition',
    before,
    after,
    metadata: { action, ...rest },
  });
}

module.exports = { ...service, log };
