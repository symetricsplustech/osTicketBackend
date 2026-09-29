const { resolveUserEffectiveAccess } = require("../../services/effectiveAccess.service");
const { buildDirectory } = require("../../services/directory.service");
const asyncHandler = require("../../utils/asyncHandler");

const tenantOf = (req) => req.companyId || req.tenantId;
const actorOf = (req) => req.agent || req.user || null;

exports.directory = asyncHandler(async (req, res) => {
  const result = await buildDirectory(tenantOf(req), req.params.instanceId, {
    search: req.query.search,
    page: req.query.page,
    limit: req.query.limit,
    userId: req.query.userId,
  });
  res.json({ success: true, ...result });
});

exports.effectiveAccessForUser = asyncHandler(async (req, res) => {
  const result = await resolveUserEffectiveAccess({
    tenantId: tenantOf(req),
    targetUserId: req.params.userId,
  });
  res.json({ success: true, ...result });
});

exports.myEffectiveAccess = asyncHandler(async (req, res) => {
  const actor = actorOf(req);
  const result = await resolveUserEffectiveAccess({
    tenantId: tenantOf(req),
    targetUserId: actor?._id,
  });
  res.json({ success: true, ...result });
});
