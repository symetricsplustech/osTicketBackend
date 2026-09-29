const userActivity = require("../../services/userActivity.service");
const sessionService = require("../../services/session.service");
const asyncHandler = require("../../utils/asyncHandler");

const tenantOf = (req) => req.companyId || req.tenantId;
const actorOf = (req) => req.agent || req.user || null;

exports.assignedWork = asyncHandler(async (req, res) => {
  const result = await userActivity.listAssignedWork({
    tenantId: tenantOf(req),
    userId: req.params.userId,
  });
  res.json({ success: true, ...result });
});

exports.workHistory = asyncHandler(async (req, res) => {
  const result = await userActivity.listWorkHistory({
    tenantId: tenantOf(req),
    userId: req.params.userId,
    limit: req.query.limit,
  });
  res.json({ success: true, ...result });
});

exports.sessions = asyncHandler(async (req, res) => {
  const result = await sessionService.listSessionsForUser({
    tenantId: tenantOf(req),
    userId: req.params.userId,
  });
  res.json({ success: true, ...result });
});

exports.revokeSession = asyncHandler(async (req, res) => {
  const actor = actorOf(req);
  const revoked = await sessionService.revokeSession({
    tenantId: tenantOf(req),
    userId: req.params.userId,
    sessionId: req.params.sessionId,
    revokedBy: actor?._id,
  });
  if (!revoked) {
    res.status(404).json({ success: false, message: "Session not found" });
    return;
  }
  res.json({ success: true, session: revoked });
});
