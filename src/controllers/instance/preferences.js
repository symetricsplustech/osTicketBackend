const preferences = require("../../services/userPreference.service");
const { audit } = require("../../services/audit.service");
const asyncHandler = require("../../utils/asyncHandler");

const tenantOf = (req) => req.companyId || req.tenantId;
const actorOf = (req) => req.agent || req.user || null;

exports.list = asyncHandler(async (req, res) => {
  const actor = actorOf(req);
  res.json({
    success: true,
    data: await preferences.listPreferences({ userId: actor?._id }),
  });
});

exports.update = asyncHandler(async (req, res) => {
  const tenantId = tenantOf(req);
  const actor = actorOf(req);
  const before = await preferences.listPreferences({ userId: actor?._id });
  const after = await preferences.updatePreferences({
    userId: actor?._id,
    locale: req.body.locale,
    timezone: req.body.timezone,
  });
  await audit({
    company: tenantId,
    actorType: "user",
    actor: actor?._id,
    actorName: actor?.name,
    action: "user.preferences.update",
    entityType: "user_preferences",
    entityId: actor?._id,
    before: { locale: before.locale, timezone: before.timezone },
    after: { locale: after.locale, timezone: after.timezone },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  res.json({ success: true, data: after });
});

exports.locales = asyncHandler(async (_req, res) => {
  res.json({ success: true, items: preferences.LOCALES, defaults: preferences.DEFAULTS });
});
