const Company = require("../models/Company");
const InstanceCompany = require("../models/InstanceCompany");
const OrganizationUnit = require("../models/OrganizationUnit");
const { runWithTenant } = require("../middleware/tenantScope");
const ApiError = require("../utils/ApiError");

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

async function companyContext(company) {
  const instance = await Company.findOne({ _id: company, isInstance: true });
  if (!instance) return { company, primary: null };
  const primary = await ensurePrimaryCompany(instance);
  await OrganizationUnit.updateMany(
    { company, instanceCompany: null },
    { $set: { instanceCompany: primary._id } },
  );
  return { company, primary };
}

async function selectedCompany(context, requestedId) {
  if (!context.primary) return null;
  const id = requestedId || context.primary._id;
  const item = await InstanceCompany.findOne({ _id: id, tenantId: context.company });
  if (!item || item.status !== "active")
    throw new ApiError(422, "Choose an active company in this instance");
  return item._id;
}

module.exports = { nameKey, ensurePrimaryCompany, companyContext, selectedCompany };
