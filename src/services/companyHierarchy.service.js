const Company = require("../models/Company");
const InstanceCompany = require("../models/InstanceCompany");
const { runWithTenant } = require("../middleware/tenantScope");

const nameKey = (name) => String(name || "").trim().replace(/\s+/g, " ").toLowerCase();

async function ensurePrimaryCompany(instance) {
  return runWithTenant(instance._id, async () => {
    let primary = await InstanceCompany.findOne({ tenantId: instance._id, isPrimary: true });
    if (!primary) {
      try {
        primary = await InstanceCompany.findOneAndUpdate(
          { tenantId: instance._id, isPrimary: true },
          { $setOnInsert: {
            tenantId: instance._id,
            name: instance.name,
            nameKey: nameKey(instance.name),
            domain: instance.domain,
            email: instance.email,
            isPrimary: true,
            ownerUser: instance.instanceOwner,
          } },
          { upsert: true, new: true },
        );
      } catch (error) {
        if (error.code !== 11000) throw error;
        primary = await InstanceCompany.findOne({ tenantId: instance._id, isPrimary: true });
        if (!primary) throw error;
      }
    }
    if (String(instance.primaryCompany || "") !== String(primary._id)) {
      await Company.updateOne(
        { _id: instance._id }, { $set: { primaryCompany: primary._id } },
      );
    }
    return primary;
  });
}

module.exports = { nameKey, ensurePrimaryCompany };
