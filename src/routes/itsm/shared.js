const SystemSetting = require("../../models/SystemSetting");

const tenantOf = (req) => req.companyId || req.tenantId || null;
const actorId = (req) => req.user?._id || req.agent?._id || null;
const uuid = (v) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
    ? v
    : null;

const getSetting = async (key, fallback) => {
  let setting = await SystemSetting.findOne({ key });
  if (!setting) {
    setting = await SystemSetting.create({ key, value: fallback });
  }
  return setting.value;
};

module.exports = { tenantOf, actorId, uuid, getSetting };
