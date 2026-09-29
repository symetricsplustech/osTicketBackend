const delegation = require("../../services/delegation.service");
const { audit } = require("../../services/audit.service");
const asyncHandler = require("../../utils/asyncHandler");

const tenantOf = (req) => req.companyId || req.tenantId;
const actorOf = (req) => req.agent || req.user || null;

exports.list = asyncHandler(async (req, res) => {
  const tenantId = tenantOf(req);
  const actor = actorOf(req);
  const userId = req.query.userId || null;
  const items = await delegation.listDelegations({
    tenantId,
    userId,
    includeInactive: req.query.includeInactive === "true",
  });
  const forMe = await delegation.activeDelegationsFor({
    tenantId,
    delegateUserId: actor?._id,
  });
  res.json({ success: true, items, activeForMe: forMe });
});

exports.create = asyncHandler(async (req, res) => {
  const tenantId = tenantOf(req);
  const actor = actorOf(req);
  const created = await delegation.createDelegation({
    tenantId,
    delegatorUserId: req.body.delegatorUserId || actor?._id,
    delegateUserId: req.body.delegateUserId,
    permissions: req.body.permissions || [],
    roleIds: req.body.roleIds || [],
    scope: req.body.scope || {},
    reason: req.body.reason || null,
    startsAt: req.body.startsAt || null,
    expiresAt: req.body.expiresAt || null,
    actorId: actor?._id,
  });
  await audit({
    company: tenantId,
    actorType: "user",
    actor: actor?._id,
    actorName: actor?.name,
    action: "delegation.create",
    entityType: "delegation",
    entityId: created.id,
    after: created,
    req,
  });
  res.status(201).json({ success: true, delegation: created });
});

exports.revoke = asyncHandler(async (req, res) => {
  const tenantId = tenantOf(req);
  const actor = actorOf(req);
  const revoked = await delegation.revokeDelegation({
    id: req.params.delegationId,
    tenantId,
    revokedBy: actor?._id,
  });
  if (!revoked) {
    res.status(404).json({ success: false, message: "Delegation not found" });
    return;
  }
  await audit({
    company: tenantId,
    actorType: "user",
    actor: actor?._id,
    actorName: actor?.name,
    action: "delegation.revoke",
    entityType: "delegation",
    entityId: revoked.id,
    after: revoked,
    req,
  });
  res.json({ success: true, delegation: revoked });
});
