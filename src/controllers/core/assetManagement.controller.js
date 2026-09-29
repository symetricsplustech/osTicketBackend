/**
 * Phase 15 Asset & Cost Management controller.
 *
 * Thin HTTP layer over the asset services: it resolves the tenant and actor
 * from the request, passes through query/body filters, and returns the
 * services' tenant-scoped results. All state rules live in the services so
 * they cannot be bypassed by another caller.
 */
const asyncHandler = require("../../utils/asyncHandler");
const catalog = require("../../services/assetCatalog.service");
const inventory = require("../../services/assetInventory.service");
const lifecycle = require("../../services/assetLifecycle.service");
const auditCost = require("../../services/assetAuditCost.service");

// The Phase 15 tables key on companies.id, which is what protectTenantPrincipal
// resolves, but stringify anyway so a driver-provided object never reaches a
// uuid column.
const tenantOf = (req) => {
  const id = req.companyId || req.tenantId;
  return id === null || id === undefined ? null : String(id);
};
const principalOf = (req) => req.agent || req.user || null;
const ctx = (req) => {
  const principal = principalOf(req);
  const actorId = principal ? principal.id || principal._id : null;
  return {
    tenantId: tenantOf(req),
    actorId: actorId === null || actorId === undefined ? null : String(actorId),
    actorName: principal ? principal.name || principal.email || "" : "",
  };
};

// Column filters arrive as a single JSON query parameter: the query string
// cannot nest, and repeated keys would be ambiguous for a generic list route.
const parseFilters = (raw) => {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
};

const listArgs = (req) => ({
  ...ctx(req),
  filters: parseFilters(req.query.filters),
  search: req.query.search || undefined,
  limit: req.query.limit ? Math.min(Number(req.query.limit), 500) : 200,
  offset: req.query.offset ? Number(req.query.offset) : 0,
  orderBy: req.query.orderBy || undefined,
  direction: req.query.direction === "asc" ? "asc" : "desc",
});

// ─── 15.2 Asset Models ─────────────────────────────────────────────────

exports.listModelCategories = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await catalog.modelCategories.list(listArgs(req))) });
});
exports.createModelCategory = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, item: await catalog.modelCategories.create({ ...ctx(req), data: req.body }) });
});
exports.updateModelCategory = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await catalog.modelCategories.update({ ...ctx(req), id: req.params.id, data: req.body }) });
});
exports.deleteModelCategory = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await catalog.modelCategories.remove({ ...ctx(req), id: req.params.id })) });
});

exports.listModels = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await catalog.assetModels.list(listArgs(req))) });
});
exports.getModel = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await catalog.assetModels.get({ tenantId: tenantOf(req), id: req.params.id }) });
});
exports.createModel = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, item: await catalog.assetModels.create({ ...ctx(req), data: req.body }) });
});
exports.updateModel = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await catalog.assetModels.update({ ...ctx(req), id: req.params.id, data: req.body }) });
});
exports.deleteModel = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await catalog.removeModel({ ...ctx(req), id: req.params.id })) });
});

// ─── 15.3 Stockrooms ───────────────────────────────────────────────────

exports.listStockrooms = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await catalog.stockrooms.list(listArgs(req))) });
});
exports.getStockroom = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await catalog.stockrooms.get({ tenantId: tenantOf(req), id: req.params.id }) });
});
exports.createStockroom = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, item: await catalog.stockrooms.create({ ...ctx(req), data: req.body }) });
});
exports.updateStockroom = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await catalog.stockrooms.update({ ...ctx(req), id: req.params.id, data: req.body }) });
});
exports.deleteStockroom = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await catalog.removeStockroom({ ...ctx(req), id: req.params.id })) });
});

// ─── 15.4 Inventory ────────────────────────────────────────────────────

exports.listBalances = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await inventory.inventoryBalances.list(listArgs(req))) });
});
exports.createBalance = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, item: await inventory.inventoryBalances.create({ ...ctx(req), data: req.body }) });
});
exports.updateBalance = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await inventory.inventoryBalances.update({ ...ctx(req), id: req.params.id, data: req.body }) });
});
exports.listStockroomInventory = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    ...(await catalog.listStockroomInventory({
      tenantId: tenantOf(req),
      stockroomId: req.params.id,
      search: req.query.search || undefined,
      lowStockOnly: req.query.lowStockOnly === "true",
    })),
  });
});
exports.setStockroomBalance = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    item: await catalog.setBalance({ ...ctx(req), stockroomId: req.params.id, balanceId: req.params.balanceId, data: req.body }),
  });
});
exports.inventoryOverview = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    ...(await inventory.inventoryOverview({
      tenantId: tenantOf(req),
      location: req.query.location || undefined,
      modelId: req.query.modelId || undefined,
      lowStockOnly: req.query.lowStockOnly === "true",
    })),
  });
});
exports.listInventoryExceptions = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await inventory.inventoryExceptions.list(listArgs(req))) });
});
exports.createInventoryException = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, item: await inventory.inventoryExceptions.create({ ...ctx(req), data: req.body }) });
});
exports.updateInventoryException = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    item: await inventory.resolveException({ ...ctx(req), id: req.params.id, status: req.body.status, note: req.body.note }),
  });
});

// ─── 15.5 Transfers ────────────────────────────────────────────────────

exports.listTransfers = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await inventory.transfers.list(listArgs(req))) });
});
exports.getTransfer = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await inventory.getTransferOrder({ tenantId: tenantOf(req), id: req.params.id }) });
});
exports.createTransfer = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, item: await inventory.createTransfer({ ...ctx(req), data: req.body }) });
});
exports.updateTransfer = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await inventory.transfers.update({ ...ctx(req), id: req.params.id, data: req.body }) });
});
exports.deleteTransfer = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await inventory.transfers.remove({ ...ctx(req), id: req.params.id })) });
});
exports.listTransferLines = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await inventory.listTransferLines({ tenantId: tenantOf(req), transferId: req.params.id })) });
});
exports.createTransferLine = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, item: await inventory.transferLines.create({ ...ctx(req), data: { ...req.body, transfer_id: req.params.id } }) });
});
exports.updateTransferLine = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await inventory.transferLines.update({ ...ctx(req), id: req.params.lineId, data: req.body }) });
});
exports.deleteTransferLine = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await inventory.transferLines.remove({ ...ctx(req), id: req.params.lineId })) });
});
exports.requestTransfer = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await inventory.requestTransfer({ ...ctx(req), id: req.params.id }) });
});
exports.shipTransfer = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    item: await inventory.shipTransfer({ ...ctx(req), id: req.params.id, carrier: req.body.carrier, notes: req.body.notes }),
  });
});
exports.receiveTransfer = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    item: await inventory.receiveTransfer({ ...ctx(req), id: req.params.id, receivedLines: req.body.receivedLines, notes: req.body.notes }),
  });
});
exports.cancelTransfer = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await inventory.cancelTransfer({ ...ctx(req), id: req.params.id, reason: req.body.reason }) });
});

// ─── 15.6 Asset Assignment ─────────────────────────────────────────────

exports.listAssignments = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await lifecycle.assetAssignments.list(listArgs(req))) });
});
exports.createAssignment = asyncHandler(async (req, res) => {
  res.status(201).json({
    success: true,
    item: await lifecycle.assignAsset({ ...ctx(req), assetId: req.body.assetId || req.body.asset_id, assignee: req.body.assignee || req.body, notes: req.body.notes, dueBackAt: req.body.dueBackAt }),
  });
});
exports.updateAssignment = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await lifecycle.assetAssignments.update({ ...ctx(req), id: req.params.id, data: req.body }) });
});
exports.deleteAssignment = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await lifecycle.assetAssignments.remove({ ...ctx(req), id: req.params.id })) });
});
exports.returnAsset = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await lifecycle.returnAsset({ ...ctx(req), assignmentId: req.params.id, condition: req.body.condition, notes: req.body.notes }) });
});
exports.swapAsset = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    item: await lifecycle.swapAsset({ ...ctx(req), assignmentId: req.params.id, replacementAssetId: req.body.replacementAssetId || req.body.replacement_asset_id, reason: req.body.reason }),
  });
});

// ─── 15.7 Asset Lifecycle ──────────────────────────────────────────────

exports.listLifecycles = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await lifecycle.listByState({ tenantId: tenantOf(req), state: req.query.state || undefined })) });
});
exports.getLifecycle = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await lifecycle.assetLifecycles.get({ tenantId: tenantOf(req), id: req.params.id }) });
});
exports.moveAsset = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    item: await lifecycle.moveAsset({
      ...ctx(req),
      assetId: req.params.id,
      to: req.body.to || req.body.state,
      substate: req.body.substate,
      reason: req.body.reason,
      disposal: req.body.disposal,
    }),
  });
});

// ─── 15.8 Asset Audit ──────────────────────────────────────────────────

exports.listAudits = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await auditCost.assetAudits.list(listArgs(req))) });
});
exports.getAudit = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await auditCost.assetAudits.get({ tenantId: tenantOf(req), id: req.params.id }) });
});
exports.createAudit = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, item: await auditCost.createAudit({ ...ctx(req), data: req.body }) });
});
exports.updateAudit = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await auditCost.assetAudits.update({ ...ctx(req), id: req.params.id, data: req.body }) });
});
exports.deleteAudit = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await auditCost.assetAudits.remove({ ...ctx(req), id: req.params.id })) });
});
exports.startAudit = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await auditCost.startAudit({ ...ctx(req), id: req.params.id }) });
});
exports.completeAudit = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await auditCost.completeAudit({ ...ctx(req), id: req.params.id }) });
});
exports.cancelAudit = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await auditCost.cancelAudit({ ...ctx(req), id: req.params.id, reason: req.body.reason }) });
});
exports.listAuditTasks = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await auditCost.listAuditTasks({ tenantId: tenantOf(req), auditId: req.params.id, status: req.query.status || undefined })) });
});
exports.createAuditTask = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, item: await auditCost.auditTasks.create({ ...ctx(req), data: { ...req.body, audit_id: req.params.id } }) });
});
exports.updateAuditTask = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    item: await auditCost.setTaskStatus({ ...ctx(req), taskId: req.params.taskId, to: req.body.status || req.body.to, countedCount: req.body.countedCount }),
  });
});
exports.deleteAuditTask = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await auditCost.auditTasks.remove({ ...ctx(req), id: req.params.taskId })) });
});
exports.listAuditResults = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await auditCost.listAuditResults({ tenantId: tenantOf(req), auditId: req.params.id, result: req.query.result || undefined })) });
});
exports.recordScan = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, item: await auditCost.recordScan({ ...ctx(req), auditId: req.params.id, data: req.body }) });
});
exports.listAuditExceptions = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    ...(await auditCost.listAuditExceptions({
      tenantId: tenantOf(req),
      openOnly: req.query.openOnly === "true",
      auditId: req.query.auditId || undefined,
    })),
  });
});
exports.resolveAuditException = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await auditCost.resolveAuditException({ ...ctx(req), resultId: req.params.id, note: req.body.note }) });
});

// ─── 15.9 Cost Management ──────────────────────────────────────────────

exports.listCostCenters = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await auditCost.costCenters.list(listArgs(req))) });
});
exports.getCostCenter = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await auditCost.costCenters.get({ tenantId: tenantOf(req), id: req.params.id }) });
});
exports.createCostCenter = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, item: await auditCost.costCenters.create({ ...ctx(req), data: req.body }) });
});
exports.updateCostCenter = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await auditCost.costCenters.update({ ...ctx(req), id: req.params.id, data: req.body }) });
});
exports.deleteCostCenter = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await auditCost.costCenters.remove({ ...ctx(req), id: req.params.id })) });
});
exports.listCosts = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await auditCost.assetCosts.list(listArgs(req))) });
});
exports.getCost = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await auditCost.assetCosts.get({ tenantId: tenantOf(req), id: req.params.id }) });
});
exports.createCost = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, item: await auditCost.assetCosts.create({ ...ctx(req), data: req.body }) });
});
exports.updateCost = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await auditCost.assetCosts.update({ ...ctx(req), id: req.params.id, data: req.body }) });
});
exports.deleteCost = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await auditCost.assetCosts.remove({ ...ctx(req), id: req.params.id })) });
});
exports.approveCost = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await auditCost.approveCost({ ...ctx(req), id: req.params.id, decision: req.body.decision }) });
});
exports.payCost = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await auditCost.payCost({ ...ctx(req), id: req.params.id }) });
});
exports.listCostAllocations = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await auditCost.listCostAllocations({ tenantId: tenantOf(req), costId: req.params.id })) });
});
exports.createCostAllocation = asyncHandler(async (req, res) => {
  res.status(201).json({
    success: true,
    item: await auditCost.createAllocation({ ...ctx(req), data: { ...req.body, cost_id: req.params.id } }),
  });
});
exports.costReport = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    ...(await auditCost.costReport({
      tenantId: tenantOf(req),
      costCenterId: req.query.costCenterId || undefined,
      from: req.query.from || undefined,
      to: req.query.to || undefined,
      costType: req.query.costType || undefined,
    })),
  });
});

// ─── 15.10 Configuration ───────────────────────────────────────────────

exports.listAssetStates = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await catalog.assetStates.list(listArgs(req))) });
});
exports.createAssetState = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, item: await catalog.assetStates.create({ ...ctx(req), data: req.body }) });
});
exports.updateAssetState = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await catalog.assetStates.update({ ...ctx(req), id: req.params.id, data: req.body }) });
});
exports.deleteAssetState = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await catalog.assetStates.remove({ ...ctx(req), id: req.params.id })) });
});
exports.listAssetSubstates = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await catalog.assetSubstates.list(listArgs(req))) });
});
exports.createAssetSubstate = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, item: await catalog.assetSubstates.create({ ...ctx(req), data: req.body }) });
});
exports.updateAssetSubstate = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await catalog.assetSubstates.update({ ...ctx(req), id: req.params.id, data: req.body }) });
});
exports.deleteAssetSubstate = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await catalog.assetSubstates.remove({ ...ctx(req), id: req.params.id })) });
});
exports.listAssetProperties = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await catalog.assetProperties.list(listArgs(req))) });
});
exports.createAssetProperty = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, item: await catalog.assetProperties.create({ ...ctx(req), data: req.body }) });
});
exports.updateAssetProperty = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await catalog.assetProperties.update({ ...ctx(req), id: req.params.id, data: req.body }) });
});
exports.deleteAssetProperty = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await catalog.assetProperties.remove({ ...ctx(req), id: req.params.id })) });
});
exports.getStockroomConfiguration = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await catalog.getStockroomConfiguration({ tenantId: tenantOf(req), stockroomId: req.params.id }) });
});
exports.saveStockroomConfiguration = asyncHandler(async (req, res) => {
  res.json({ success: true, item: await catalog.saveStockroomConfiguration({ ...ctx(req), stockroomId: req.params.id, data: req.body }) });
});
exports.listConfiguredStates = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await catalog.listConfiguredStates({ tenantId: tenantOf(req) })) });
});
