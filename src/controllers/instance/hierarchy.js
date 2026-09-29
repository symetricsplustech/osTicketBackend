const hierarchy = require("../../services/hierarchy.service");
const { audit } = require("../../services/audit.service");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");

const tenantOf = (req) => req.companyId || req.tenantId;
const actorOf = (req) => req.agent || req.user || null;

exports.getReportingLine = asyncHandler(async (req, res) => {
  const tenantId = tenantOf(req);
  const userId = req.params.userId || actorOf(req)?._id;
  const line = await hierarchy.activeReportingLine(tenantId, userId);
  const directReports = await hierarchy.getDirectReports(tenantId, userId);
  const chain = await hierarchy.getReportingChain(tenantId, userId);
  res.json({ success: true, reportingLine: line, directReports, chain });
});

exports.setReportingLine = asyncHandler(async (req, res) => {
  const tenantId = tenantOf(req);
  const actor = actorOf(req);
  const userId = req.params.userId;
  const before = await hierarchy.activeReportingLine(tenantId, userId);
  const line = await hierarchy.setReportingLine({
    tenantId,
    memberUserId: userId,
    managerUserId: req.body.managerUserId ?? null,
    teamLeadUserId: req.body.teamLeadUserId ?? null,
    delegatedManagerUserId: req.body.delegatedManagerUserId ?? null,
    effectiveFrom: req.body.effectiveFrom ?? null,
    effectiveTo: req.body.effectiveTo ?? null,
    notes: req.body.notes ?? null,
    actorId: actor?._id,
  });
  await audit({
    company: tenantId,
    actorType: "user",
    actor: actor?._id,
    actorName: actor?.name,
    action: "reporting_line.set",
    entityType: "reporting_line",
    entityId: line.id,
    before,
    after: line,
    req,
  });
  res.json({ success: true, reportingLine: line });
});

exports.clearReportingLine = asyncHandler(async (req, res) => {
  const tenantId = tenantOf(req);
  const actor = actorOf(req);
  const userId = req.params.userId;
  const before = await hierarchy.activeReportingLine(tenantId, userId);
  const result = await hierarchy.clearReportingLine({
    tenantId,
    memberUserId: userId,
    actorId: actor?._id,
  });
  await audit({
    company: tenantId,
    actorType: "user",
    actor: actor?._id,
    actorName: actor?.name,
    action: "reporting_line.clear",
    entityType: "reporting_line",
    entityId: before?.id || userId,
    before,
    after: null,
    req,
  });
  res.json({ success: true, ...result });
});

exports.listDirectReports = asyncHandler(async (req, res) => {
  const tenantId = tenantOf(req);
  const userId = req.query.userId || actorOf(req)?._id;
  const items = await hierarchy.getDirectReports(tenantId, userId);
  res.json({ success: true, items });
});

exports.getReportingChain = asyncHandler(async (req, res) => {
  const tenantId = tenantOf(req);
  const items = await hierarchy.getReportingChain(tenantId, req.params.userId);
  res.json({ success: true, items });
});

exports.getEngineerProfile = asyncHandler(async (req, res) => {
  const tenantId = tenantOf(req);
  const profile = await hierarchy.getEngineerProfile(tenantId, req.params.userId);
  res.json({ success: true, profile });
});

exports.upsertEngineerProfile = asyncHandler(async (req, res) => {
  const tenantId = tenantOf(req);
  const actor = actorOf(req);
  const userId = req.params.userId;
  if (!userId) throw new ApiError(422, "A user id is required");
  const before = await hierarchy.getEngineerProfile(tenantId, userId);
  const profile = await hierarchy.upsertEngineerProfile({
    tenantId,
    userId,
    availability: req.body.availability,
    skills: req.body.skills,
    territories: req.body.territories,
    schedule: req.body.schedule,
    notes: req.body.notes,
    actorId: actor?._id,
  });
  await audit({
    company: tenantId,
    actorType: "user",
    actor: actor?._id,
    actorName: actor?.name,
    action: before ? "engineer_profile.update" : "engineer_profile.create",
    entityType: "engineer_profile",
    entityId: profile.id,
    before,
    after: profile,
    req,
  });
  res.json({ success: true, profile });
});
