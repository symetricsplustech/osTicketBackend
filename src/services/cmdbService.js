/**
 * CMDB / Service Portfolio / Service Builder service — unified engine for
 * service portfolio management, business/technical services, offerings,
 * configuration items, relationships, dependencies, commitments, and impact analysis.
 */
const mongoose = require("mongoose");
const numberingService = require("./numbering.service");
const auditEventService = require("./auditEventService");
const { emitEvent } = require("../realtime/socketManager");

// Register CMDB models before retrieving them from Mongoose's registry.
require("../models/cmdb/ServicePortfolio");
require("../models/cmdb/BusinessService");
require("../models/cmdb/TechnicalService");
require("../models/cmdb/ServiceOffering");
require("../models/cmdb/ConfigurationItem");
require("../models/cmdb/CIRelationship");
require("../models/cmdb/ServiceOwner");
require("../models/cmdb/ServiceCommitment");
require("../models/cmdb/ServiceLevelCommitment");
require("../models/cmdb/Dependency");

const requireTenant = (ctx) => {
  if (!ctx.tenantId)
    throw Object.assign(new Error("Tenant context required"), {
      statusCode: 400,
    });
  return ctx.tenantId;
};
const pick = (obj, keys) =>
  Object.fromEntries(
    keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]),
  );

const ServicePortfolio = mongoose.model("ServicePortfolio");
const BusinessService = mongoose.model("BusinessService");
const TechnicalService = mongoose.model("TechnicalService");
const ServiceOffering = mongoose.model("ServiceOffering");
const ConfigurationItem = mongoose.model("ConfigurationItem");
const CIRelationship = mongoose.model("CIRelationship");
const ServiceOwner = mongoose.model("ServiceOwner");
const ServiceCommitment = mongoose.model("ServiceCommitment");
const ServiceLevelCommitment = mongoose.model("ServiceLevelCommitment");
const Dependency = mongoose.model("Dependency");

// ─── Service Portfolio ──────────────────────────────────────────────────

exports.listPortfolios = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = { tenantId, isDeleted: false, ...pick(query, ["status"]) };
  if (query.search)
    filter.$or = [{ name: { $regex: query.search, $options: "i" } }];
  return ServicePortfolio.find(filter).sort({ name: 1 });
};

exports.getPortfolio = async (ctx, portfolioId) => {
  const tenantId = requireTenant(ctx);
  const portfolio = await ServicePortfolio.findOne({
    _id: portfolioId,
    tenantId,
    isDeleted: false,
  });
  if (!portfolio)
    throw Object.assign(new Error("Service portfolio not found"), {
      statusCode: 404,
    });
  return portfolio;
};

exports.createPortfolio = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, "SPF");
  return ServicePortfolio.create({
    ...data,
    tenantId,
    number,
    createdBy: actor.userId,
  });
};

exports.updatePortfolio = async (ctx, portfolioId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const portfolio = await ServicePortfolio.findOne({
    _id: portfolioId,
    tenantId,
    isDeleted: false,
  });
  if (!portfolio)
    throw Object.assign(new Error("Service portfolio not found"), {
      statusCode: 404,
    });
  const allowed = [
    "name",
    "description",
    "status",
    "ownerId",
    "ownerGroupId",
    "governance",
    "metadata",
  ];
  Object.assign(portfolio, pick(data, allowed));
  await portfolio.save();
  return portfolio;
};

exports.deletePortfolio = async (ctx, portfolioId, actor) => {
  const tenantId = requireTenant(ctx);
  const portfolio = await ServicePortfolio.findOne({
    _id: portfolioId,
    tenantId,
    isDeleted: false,
  });
  if (!portfolio)
    throw Object.assign(new Error("Service portfolio not found"), {
      statusCode: 404,
    });
  portfolio.isDeleted = true;
  portfolio.deletedAt = new Date();
  portfolio.deletedBy = actor.userId;
  await portfolio.save();
  return { success: true };
};

// ─── Business Service ───────────────────────────────────────────────────

exports.listBusinessServices = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, [
      "portfolioId",
      "status",
      "category",
      "criticality",
      "ownerId",
      "ownerGroupId",
    ]),
  };
  if (query.search)
    filter.$or = [{ name: { $regex: query.search, $options: "i" } }];
  return BusinessService.find(filter).sort({ name: 1 });
};

exports.getBusinessService = async (ctx, serviceId) => {
  const tenantId = requireTenant(ctx);
  const svc = await BusinessService.findOne({
    _id: serviceId,
    tenantId,
    isDeleted: false,
  });
  if (!svc)
    throw Object.assign(new Error("Business service not found"), {
      statusCode: 404,
    });
  return svc;
};

exports.createBusinessService = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, "BSVC");
  return BusinessService.create({
    ...data,
    tenantId,
    number,
    createdBy: actor.userId,
  });
};

exports.updateBusinessService = async (ctx, serviceId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const svc = await BusinessService.findOne({
    _id: serviceId,
    tenantId,
    isDeleted: false,
  });
  if (!svc)
    throw Object.assign(new Error("Business service not found"), {
      statusCode: 404,
    });
  const allowed = [
    "name",
    "description",
    "category",
    "criticality",
    "status",
    "ownerId",
    "ownerGroupId",
    "supportGroupId",
    "availabilityTarget",
    "availabilityTargetUnit",
    "operatingHours",
    "serviceLevelCommitments",
    "metadata",
  ];
  Object.assign(svc, pick(data, allowed));
  await svc.save();
  return svc;
};

exports.deleteBusinessService = async (ctx, serviceId, actor) => {
  const tenantId = requireTenant(ctx);
  const svc = await BusinessService.findOne({
    _id: serviceId,
    tenantId,
    isDeleted: false,
  });
  if (!svc)
    throw Object.assign(new Error("Business service not found"), {
      statusCode: 404,
    });
  svc.isDeleted = true;
  svc.deletedAt = new Date();
  svc.deletedBy = actor.userId;
  await svc.save();
  return { success: true };
};

// ─── Technical Service ──────────────────────────────────────────────────

exports.listTechnicalServices = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, ["businessServiceId", "status", "type", "environment"]),
  };
  if (query.search)
    filter.$or = [{ name: { $regex: query.search, $options: "i" } }];
  return TechnicalService.find(filter).sort({ name: 1 });
};

exports.getTechnicalService = async (ctx, serviceId) => {
  const tenantId = requireTenant(ctx);
  const svc = await TechnicalService.findOne({
    _id: serviceId,
    tenantId,
    isDeleted: false,
  });
  if (!svc)
    throw Object.assign(new Error("Technical service not found"), {
      statusCode: 404,
    });
  return svc;
};

exports.createTechnicalService = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, "TSVC");
  return TechnicalService.create({
    ...data,
    tenantId,
    number,
    createdBy: actor.userId,
  });
};

exports.updateTechnicalService = async (ctx, serviceId, data) => {
  const tenantId = requireTenant(ctx);
  const svc = await TechnicalService.findOne({
    _id: serviceId,
    tenantId,
    isDeleted: false,
  });
  if (!svc)
    throw Object.assign(new Error("Technical service not found"), {
      statusCode: 404,
    });
  const allowed = [
    "name",
    "description",
    "type",
    "status",
    "environment",
    "technologyStack",
    "hostingLocation",
    "ownerId",
    "ownerGroupId",
    "supportedBy",
    "dependencies",
    "metadata",
  ];
  Object.assign(svc, pick(data, allowed));
  await svc.save();
  return svc;
};

exports.deleteTechnicalService = async (ctx, serviceId, actor) => {
  const tenantId = requireTenant(ctx);
  const svc = await TechnicalService.findOne({
    _id: serviceId,
    tenantId,
    isDeleted: false,
  });
  if (!svc)
    throw Object.assign(new Error("Technical service not found"), {
      statusCode: 404,
    });
  svc.isDeleted = true;
  svc.deletedAt = new Date();
  svc.deletedBy = actor.userId;
  await svc.save();
  return { success: true };
};

// ─── Service Offering ───────────────────────────────────────────────────

exports.listServiceOfferings = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, ["businessServiceId", "status", "type", "category"]),
  };
  if (query.search)
    filter.$or = [{ name: { $regex: query.search, $options: "i" } }];
  return ServiceOffering.find(filter).sort({ name: 1 });
};

exports.getServiceOffering = async (ctx, offeringId) => {
  const tenantId = requireTenant(ctx);
  const off = await ServiceOffering.findOne({
    _id: offeringId,
    tenantId,
    isDeleted: false,
  });
  if (!off)
    throw Object.assign(new Error("Service offering not found"), {
      statusCode: 404,
    });
  return off;
};

exports.createServiceOffering = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, "SOFF");
  return ServiceOffering.create({
    ...data,
    tenantId,
    number,
    createdBy: actor.userId,
  });
};

exports.updateServiceOffering = async (ctx, offeringId, data) => {
  const tenantId = requireTenant(ctx);
  const off = await ServiceOffering.findOne({
    _id: offeringId,
    tenantId,
    isDeleted: false,
  });
  if (!off)
    throw Object.assign(new Error("Service offering not found"), {
      statusCode: 404,
    });
  const allowed = [
    "name",
    "description",
    "type",
    "status",
    "category",
    "pricing",
    "fulfillment",
    "slaCommitments",
    "supportHours",
    "catalogItemId",
    "metadata",
  ];
  Object.assign(off, pick(data, allowed));
  await off.save();
  return off;
};

exports.deleteServiceOffering = async (ctx, offeringId, actor) => {
  const tenantId = requireTenant(ctx);
  const off = await ServiceOffering.findOne({
    _id: offeringId,
    tenantId,
    isDeleted: false,
  });
  if (!off)
    throw Object.assign(new Error("Service offering not found"), {
      statusCode: 404,
    });
  off.isDeleted = true;
  off.deletedAt = new Date();
  off.deletedBy = actor.userId;
  await off.save();
  return { success: true };
};

// ─── Configuration Item ─────────────────────────────────────────────────

exports.listCIs = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, [
      "ciClass",
      "ciSubclass",
      "environment",
      "criticality",
      "status",
      "lifecycleState",
      "ownerId",
      "ownerGroupId",
      "supportGroupId",
    ]),
  };
  if (query.search)
    filter.$or = [
      {
        name: { $regex: query.search, $options: "i" },
        serialNumber: { $regex: query.search, $options: "i" },
        hostname: { $regex: query.search, $options: "i" },
        ipAddress: { $regex: query.search, $options: "i" },
      },
    ];
  return ConfigurationItem.find(filter).sort({ name: 1 });
};

exports.getCI = async (ctx, ciId) => {
  const tenantId = requireTenant(ctx);
  const ci = await ConfigurationItem.findOne({
    _id: ciId,
    tenantId,
    isDeleted: false,
  });
  if (!ci)
    throw Object.assign(new Error("Configuration item not found"), {
      statusCode: 404,
    });
  return ci;
};

exports.createCI = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, "CI");
  return ConfigurationItem.create({
    ...data,
    tenantId,
    number,
    createdBy: actor.userId,
  });
};

exports.updateCI = async (ctx, ciId, data) => {
  const tenantId = requireTenant(ctx);
  const ci = await ConfigurationItem.findOne({
    _id: ciId,
    tenantId,
    isDeleted: false,
  });
  if (!ci)
    throw Object.assign(new Error("Configuration item not found"), {
      statusCode: 404,
    });
  const allowed = [
    "name",
    "description",
    "ciClass",
    "ciSubclass",
    "environment",
    "criticality",
    "status",
    "lifecycleState",
    "manufacturer",
    "model",
    "serialNumber",
    "assetTag",
    "ipAddress",
    "macAddress",
    "hostname",
    "operatingSystem",
    "version",
    "location",
    "rack",
    "dataCenter",
    "ownerId",
    "ownerGroupId",
    "supportGroupId",
    "businessServices",
    "technicalServices",
    "serviceOfferings",
    "attributes",
    "customFields",
    "lastScannedAt",
    "lastCertifiedAt",
    "certifiedBy",
    "metadata",
  ];
  Object.assign(ci, pick(data, allowed));
  await ci.save();
  return ci;
};

exports.deleteCI = async (ctx, ciId, actor) => {
  const tenantId = requireTenant(ctx);
  const ci = await ConfigurationItem.findOne({
    _id: ciId,
    tenantId,
    isDeleted: false,
  });
  if (!ci)
    throw Object.assign(new Error("Configuration item not found"), {
      statusCode: 404,
    });
  ci.isDeleted = true;
  ci.deletedAt = new Date();
  ci.deletedBy = actor.userId;
  await ci.save();
  return { success: true };
};

// ─── CI Relationships ──────────────────────────────────────────────────

exports.listRelationships = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, [
      "sourceCIId",
      "targetCIId",
      "relationshipType",
      "isActive",
    ]),
  };
  return CIRelationship.find(filter).sort({ createdAt: -1 });
};

exports.getRelationship = async (ctx, relId) => {
  const tenantId = requireTenant(ctx);
  const rel = await CIRelationship.findOne({
    _id: relId,
    tenantId,
    isDeleted: false,
  });
  if (!rel)
    throw Object.assign(new Error("CI relationship not found"), {
      statusCode: 404,
    });
  return rel;
};

exports.createRelationship = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  // Prevent circular reference
  if (data.sourceCIId === data.targetCIId)
    throw Object.assign(new Error("Cannot create relationship to self"), {
      statusCode: 422,
    });
  return CIRelationship.create({ ...data, tenantId, createdBy: actor.userId });
};

exports.updateRelationship = async (ctx, relId, data) => {
  const tenantId = requireTenant(ctx);
  const rel = await CIRelationship.findOne({
    _id: relId,
    tenantId,
    isDeleted: false,
  });
  if (!rel)
    throw Object.assign(new Error("CI relationship not found"), {
      statusCode: 404,
    });
  const allowed = [
    "relationshipType",
    "direction",
    "strength",
    "isActive",
    "description",
    "metadata",
  ];
  Object.assign(rel, pick(data, allowed));
  await rel.save();
  return rel;
};

exports.deleteRelationship = async (ctx, relId, actor) => {
  const tenantId = requireTenant(ctx);
  const rel = await CIRelationship.findOne({
    _id: relId,
    tenantId,
    isDeleted: false,
  });
  if (!rel)
    throw Object.assign(new Error("CI relationship not found"), {
      statusCode: 404,
    });
  rel.isDeleted = true;
  rel.deletedAt = new Date();
  rel.deletedBy = actor.userId;
  await rel.save();
  return { success: true };
};

// ─── Service Owners ────────────────────────────────────────────────────

exports.listServiceOwners = async (ctx, serviceId) => {
  const tenantId = requireTenant(ctx);
  return ServiceOwner.find({ tenantId, serviceId }).populate(
    "userId",
    "name email",
  );
};

exports.assignServiceOwner = async (ctx, serviceId, data, actor) => {
  const tenantId = requireTenant(ctx);
  if (data.isPrimary) {
    await ServiceOwner.updateMany(
      { tenantId, serviceId, isPrimary: true },
      { isPrimary: false },
    );
  }
  return ServiceOwner.create({
    ...data,
    tenantId,
    serviceId,
    createdBy: actor.userId,
  });
};

exports.removeServiceOwner = async (ctx, ownerId) => {
  const tenantId = requireTenant(ctx);
  return ServiceOwner.findOneAndDelete({ _id: ownerId, tenantId });
};

// ─── Service Commitments ───────────────────────────────────────────────

exports.listServiceCommitments = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, ["serviceId", "offeringId", "type", "status"]),
  };
  return ServiceCommitment.find(filter).sort({ type: 1 });
};

exports.getServiceCommitment = async (ctx, commitmentId) => {
  const tenantId = requireTenant(ctx);
  const c = await ServiceCommitment.findOne({
    _id: commitmentId,
    tenantId,
    isDeleted: false,
  });
  if (!c)
    throw Object.assign(new Error("Service commitment not found"), {
      statusCode: 404,
    });
  return c;
};

exports.createServiceCommitment = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  return ServiceCommitment.create({
    ...data,
    tenantId,
    createdBy: actor.userId,
  });
};

exports.updateServiceCommitment = async (ctx, commitmentId, data) => {
  const tenantId = requireTenant(ctx);
  const c = await ServiceCommitment.findOne({
    _id: commitmentId,
    tenantId,
    isDeleted: false,
  });
  if (!c)
    throw Object.assign(new Error("Service commitment not found"), {
      statusCode: 404,
    });
  const allowed = [
    "name",
    "description",
    "type",
    "targetValue",
    "targetUnit",
    "measurementWindow",
    "calculationMethod",
    "threshold",
    "reportingFrequency",
    "status",
    "startDate",
    "endDate",
    "penalty",
    "metadata",
  ];
  Object.assign(c, pick(data, allowed));
  await c.save();
  return c;
};

exports.deleteServiceCommitment = async (ctx, commitmentId, actor) => {
  const tenantId = requireTenant(ctx);
  const c = await ServiceCommitment.findOne({
    _id: commitmentId,
    tenantId,
    isDeleted: false,
  });
  if (!c)
    throw Object.assign(new Error("Service commitment not found"), {
      statusCode: 404,
    });
  c.isDeleted = true;
  c.deletedAt = new Date();
  c.deletedBy = actor.userId;
  await c.save();
  return { success: true };
};

// ─── Service Level Commitments ─────────────────────────────────────────

exports.listSLCs = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, ["type", "scope", "status"]),
  };
  return ServiceLevelCommitment.find(filter).sort({ name: 1 });
};

exports.getSLC = async (ctx, slcId) => {
  const tenantId = requireTenant(ctx);
  const slc = await ServiceLevelCommitment.findOne({
    _id: slcId,
    tenantId,
    isDeleted: false,
  });
  if (!slc)
    throw Object.assign(new Error("Service level commitment not found"), {
      statusCode: 404,
    });
  return slc;
};

exports.createSLC = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, "SLC");
  return ServiceLevelCommitment.create({
    ...data,
    tenantId,
    number,
    createdBy: actor.userId,
  });
};

exports.updateSLC = async (ctx, slcId, data) => {
  const tenantId = requireTenant(ctx);
  const slc = await ServiceLevelCommitment.findOne({
    _id: slcId,
    tenantId,
    isDeleted: false,
  });
  if (!slc)
    throw Object.assign(new Error("Service level commitment not found"), {
      statusCode: 404,
    });
  const allowed = [
    "name",
    "description",
    "type",
    "scope",
    "targetValue",
    "targetUnit",
    "measurementWindow",
    "businessHoursOnly",
    "scheduleId",
    "escalationPolicyId",
    "penalty",
    "status",
    "startDate",
    "endDate",
    "metadata",
  ];
  Object.assign(slc, pick(data, allowed));
  await slc.save();
  return slc;
};

exports.deleteSLC = async (ctx, slcId, actor) => {
  const tenantId = requireTenant(ctx);
  const slc = await ServiceLevelCommitment.findOne({
    _id: slcId,
    tenantId,
    isDeleted: false,
  });
  if (!slc)
    throw Object.assign(new Error("Service level commitment not found"), {
      statusCode: 404,
    });
  slc.isDeleted = true;
  slc.deletedAt = new Date();
  slc.deletedBy = actor.userId;
  await slc.save();
  return { success: true };
};

// ─── Dependencies ──────────────────────────────────────────────────────

exports.listDependencies = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, [
      "sourceType",
      "sourceId",
      "targetType",
      "targetId",
      "dependencyType",
      "criticality",
      "isActive",
      "validationStatus",
    ]),
  };
  return Dependency.find(filter).sort({ createdAt: -1 });
};

exports.getDependency = async (ctx, depId) => {
  const tenantId = requireTenant(ctx);
  const dep = await Dependency.findOne({
    _id: depId,
    tenantId,
    isDeleted: false,
  });
  if (!dep)
    throw Object.assign(new Error("Dependency not found"), { statusCode: 404 });
  return dep;
};

exports.createDependency = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  if (data.sourceType === data.targetType && data.sourceId === data.targetId)
    throw Object.assign(new Error("Cannot create dependency to self"), {
      statusCode: 422,
    });
  return Dependency.create({ ...data, tenantId, createdBy: actor.userId });
};

exports.updateDependency = async (ctx, depId, data) => {
  const tenantId = requireTenant(ctx);
  const dep = await Dependency.findOne({
    _id: depId,
    tenantId,
    isDeleted: false,
  });
  if (!dep)
    throw Object.assign(new Error("Dependency not found"), { statusCode: 404 });
  const allowed = [
    "name",
    "description",
    "dependencyType",
    "criticality",
    "impactType",
    "isActive",
    "isBidirectional",
    "validationStatus",
    "metadata",
  ];
  Object.assign(dep, pick(data, allowed));
  await dep.save();
  return dep;
};

exports.deleteDependency = async (ctx, depId, actor) => {
  const tenantId = requireTenant(ctx);
  const dep = await Dependency.findOne({
    _id: depId,
    tenantId,
    isDeleted: false,
  });
  if (!dep)
    throw Object.assign(new Error("Dependency not found"), { statusCode: 404 });
  dep.isDeleted = true;
  dep.deletedAt = new Date();
  dep.deletedBy = actor.userId;
  await dep.save();
  return { success: true };
};

// ─── Impact Analysis ──────────────────────────────────────────────────

exports.analyzeImpact = async (ctx, ciId, options = {}) => {
  const tenantId = requireTenant(ctx);
  const {
    maxDepth = 3,
    includeInactive = false,
    direction = "upstream",
  } = options;

  const ci = await ConfigurationItem.findOne({
    _id: ciId,
    tenantId,
    isDeleted: false,
  });
  if (!ci)
    throw Object.assign(new Error("Configuration item not found"), {
      statusCode: 404,
    });

  const visited = new Set();
  const impacted = [];
  const queue = [{ ciId, depth: 0, path: [] }];

  while (queue.length) {
    const { ciId: currentId, depth, path } = queue.shift();
    if (depth > maxDepth) continue;
    if (visited.has(currentId.toString())) continue;
    visited.add(currentId.toString());

    let relations;
    if (direction === "upstream") {
      relations = await CIRelationship.find({
        tenantId,
        targetCIId: currentId,
        isActive: true,
        isDeleted: false,
      });
    } else {
      relations = await CIRelationship.find({
        tenantId,
        sourceCIId: currentId,
        isActive: true,
        isDeleted: false,
      });
    }

    for (const rel of relations) {
      const nextId = direction === "upstream" ? rel.sourceCIId : rel.targetCIId;
      if (!visited.has(nextId.toString())) {
        const nextCI = await ConfigurationItem.findOne({
          _id: nextId,
          tenantId,
          isDeleted: false,
        });
        if (nextCI) {
          impacted.push({
            ci: nextCI,
            relationship: rel,
            depth,
            path: [...path, rel.relationshipType],
          });
          queue.push({
            ciId: nextId,
            depth: depth + 1,
            path: [...path, rel.relationshipType],
          });
        }
      }
    }
  }

  // Also check dependencies
  const deps = await Dependency.find({
    tenantId,
    $or: [
      { sourceType: "ci", sourceId: ciId },
      { targetType: "ci", targetId: ciId },
    ],
    isActive: true,
    isDeleted: false,
  });

  for (const dep of deps) {
    const otherId =
      dep.sourceType === "ci" && dep.sourceId === ciId
        ? dep.targetId
        : dep.sourceId;
    const otherType =
      dep.sourceType === "ci" && dep.sourceId === ciId
        ? dep.targetType
        : dep.sourceType;
    if (otherType === "ci") {
      const depCI = await ConfigurationItem.findOne({
        _id: otherId,
        tenantId,
        isDeleted: false,
      });
      if (depCI) {
        impacted.push({
          ci: depCI,
          dependency: dep,
          depth: 1,
          path: [dep.dependencyType],
        });
      }
    }
  }

  return { sourceCI: ci, impacted, totalImpacted: impacted.length };
};

exports.analyzeServiceImpact = async (ctx, serviceId) => {
  const tenantId = requireTenant(ctx);
  const service = await BusinessService.findOne({
    _id: serviceId,
    tenantId,
    isDeleted: false,
  });
  if (!service)
    throw Object.assign(new Error("Business service not found"), {
      statusCode: 404,
    });

  // Find all CIs linked to this service
  const cis = await ConfigurationItem.find({
    tenantId,
    businessServices: serviceId,
    isDeleted: false,
  });

  const impacts = [];
  for (const ci of cis) {
    const impact = await exports.analyzeImpact(ctx, ci._id);
    impacts.push({ ci, impact });
  }

  // Also check dependencies
  const deps = await Dependency.find({
    tenantId,
    $or: [
      { sourceType: "business_service", sourceId: serviceId },
      { targetType: "business_service", targetId: serviceId },
    ],
    isActive: true,
    isDeleted: false,
  });

  return { service, cis, impacts, dependencies: deps };
};

// ─── Dependency Map / Graph ────────────────────────────────────────────

exports.getDependencyGraph = async (ctx, options = {}) => {
  const tenantId = requireTenant(ctx);
  const { ciId, serviceId, maxDepth = 2, direction = "both" } = options;

  const nodes = [];
  const edges = [];
  const visited = new Set();

  const addNode = (ci, depth) => {
    const key = ci._id.toString();
    if (!visited.has(key)) {
      visited.add(key);
      nodes.push({
        id: ci._id,
        label: ci.name,
        ciClass: ci.ciClass,
        criticality: ci.criticality,
        status: ci.status,
        environment: ci.environment,
        depth,
      });
    }
  };

  if (ciId) {
    const startCI = await ConfigurationItem.findOne({
      _id: ciId,
      tenantId,
      isDeleted: false,
    });
    if (startCI) {
      addNode(startCI, 0);
      await traverseGraph(startCI._id, 0);
    }
  }

  if (serviceId) {
    const cis = await ConfigurationItem.find({
      tenantId,
      businessServices: serviceId,
      isDeleted: false,
    });
    for (const ci of cis) {
      addNode(ci, 0);
      await traverseGraph(ci._id, 0);
    }
  }

  async function traverseGraph(currentId, depth) {
    if (depth >= maxDepth) return;

    let relations = [];
    if (direction === "upstream" || direction === "both") {
      relations.push(
        ...(await CIRelationship.find({
          tenantId,
          targetCIId: currentId,
          isActive: true,
          isDeleted: false,
        })),
      );
    }
    if (direction === "downstream" || direction === "both") {
      relations.push(
        ...(await CIRelationship.find({
          tenantId,
          sourceCIId: currentId,
          isActive: true,
          isDeleted: false,
        })),
      );
    }

    for (const rel of relations) {
      const nextId =
        direction === "upstream"
          ? rel.sourceCIId
          : direction === "downstream"
            ? rel.targetCIId
            : rel.sourceCIId;
      const key = nextId.toString();
      if (!visited.has(key)) {
        const nextCI = await ConfigurationItem.findOne({
          _id: nextId,
          tenantId,
          isDeleted: false,
        });
        if (nextCI) {
          addNode(nextCI, depth + 1);
          edges.push({
            from: currentId,
            to: nextId,
            relationshipType: rel.relationshipType,
            direction: rel.direction,
            strength: rel.strength,
          });
          await traverseGraph(nextId, depth + 1);
        }
      }
    }
  }

  return { nodes, edges };
};

// ─── CI Health / Dashboard ────────────────────────────────────────────

exports.getDashboard = async (ctx) => {
  const tenantId = requireTenant(ctx);
  const [
    portfolios,
    businessServices,
    technicalServices,
    offerings,
    cis,
    relationships,
    dependencies,
    commitments,
  ] = await Promise.all([
    ServicePortfolio.find({ tenantId, isDeleted: false }),
    BusinessService.find({ tenantId, isDeleted: false }),
    TechnicalService.find({ tenantId, isDeleted: false }),
    ServiceOffering.find({ tenantId, isDeleted: false }),
    ConfigurationItem.find({ tenantId, isDeleted: false }),
    CIRelationship.find({ tenantId, isDeleted: false, isActive: true }),
    Dependency.find({ tenantId, isDeleted: false, isActive: true }),
    ServiceCommitment.find({ tenantId, isDeleted: false }),
  ]);

  const ciStatusBreakdown = {};
  for (const ci of cis) {
    ciStatusBreakdown[ci.status] = (ciStatusBreakdown[ci.status] || 0) + 1;
  }

  const ciCriticalityBreakdown = {};
  for (const ci of cis) {
    ciCriticalityBreakdown[ci.criticality] =
      (ciCriticalityBreakdown[ci.criticality] || 0) + 1;
  }

  const ciEnvironmentBreakdown = {};
  for (const ci of cis) {
    ciEnvironmentBreakdown[ci.environment] =
      (ciEnvironmentBreakdown[ci.environment] || 0) + 1;
  }

  const staleCIs = cis.filter(
    (ci) =>
      ci.lastScannedAt &&
      Date.now() - ci.lastScannedAt.getTime() > 90 * 24 * 60 * 60 * 1000,
  ).length;
  const uncertifiedCIs = cis.filter((ci) => !ci.lastCertifiedAt).length;
  const noOwnerCIs = cis.filter((ci) => !ci.ownerId && !ci.ownerGroupId).length;

  const totalRelationships = relationships.length;
  const totalDependencies = dependencies.length;

  const activeBusinessServices = businessServices.filter(
    (s) => s.status === "active",
  ).length;
  const activeTechnicalServices = technicalServices.filter(
    (s) => s.status === "active",
  ).length;
  const activeOfferings = offerings.filter((o) => o.status === "active").length;

  const avgRelationshipsPerCI =
    cis.length > 0 ? ((totalRelationships * 2) / cis.length).toFixed(1) : 0;

  return {
    portfolios: portfolios.length,
    activePortfolios: portfolios.filter((p) => p.status === "active").length,
    businessServices: businessServices.length,
    activeBusinessServices,
    technicalServices: technicalServices.length,
    activeTechnicalServices,
    offerings: offerings.length,
    activeOfferings,
    cis: cis.length,
    ciStatusBreakdown,
    ciCriticalityBreakdown,
    ciEnvironmentBreakdown,
    relationships: totalRelationships,
    dependencies: totalDependencies,
    avgRelationshipsPerCI,
    staleCIs,
    uncertifiedCIs,
    noOwnerCIs,
    healthScore:
      cis.length > 0
        ? Math.max(
            0,
            100 - ((staleCIs + uncertifiedCIs + noOwnerCIs) / cis.length) * 100,
          )
        : 100,
  };
};

// ─── CI Search / Discovery ──────────────────────────────────────────────

exports.searchCIs = async (ctx, query) => {
  const tenantId = requireTenant(ctx);
  const { q, ciClass, environment, criticality, status, limit = 50 } = query;
  const filter = { tenantId, isDeleted: false };
  if (q)
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
      { serialNumber: { $regex: q, $options: "i" } },
      { hostname: { $regex: q, $options: "i" } },
      { ipAddress: { $regex: q, $options: "i" } },
    ];
  if (ciClass) filter.ciClass = ciClass;
  if (environment) filter.environment = environment;
  if (criticality) filter.criticality = criticality;
  if (status) filter.status = status;
  return ConfigurationItem.find(filter)
    .limit(parseInt(limit))
    .sort({ name: 1 });
};

// ─── CI Certification / Compliance ──────────────────────────────────────

exports.certifyCI = async (ctx, ciId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const ci = await ConfigurationItem.findOne({
    _id: ciId,
    tenantId,
    isDeleted: false,
  });
  if (!ci)
    throw Object.assign(new Error("Configuration item not found"), {
      statusCode: 404,
    });
  ci.lastCertifiedAt = new Date();
  ci.certifiedBy = actor.userId;
  if (data.attributes) ci.attributes = { ...ci.attributes, ...data.attributes };
  await ci.save();
  return ci;
};

exports.getNonCompliantCIs = async (ctx) => {
  const tenantId = requireTenant(ctx);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  return ConfigurationItem.find({
    tenantId,
    isDeleted: false,
    $or: [
      { lastScannedAt: { $lt: ninetyDaysAgo } },
      { lastCertifiedAt: { $exists: false } },
      {
        $and: [
          { ownerId: { $exists: false } },
          { ownerGroupId: { $exists: false } },
        ],
      },
    ],
  }).limit(100);
};

module.exports.pick = pick;
