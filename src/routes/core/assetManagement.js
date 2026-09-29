/**
 * Phase 15 Asset & Cost Management API routes — /core/assets/*
 *
 * Read endpoints require the matching `.read` permission and every mutation
 * requires its own `.create`/`.update`/`.delete` or action permission, so an
 * agent who can read the asset list cannot move an asset's lifecycle state.
 */
const router = require("express").Router();
const ctrl = require("../../controllers/core/assetManagement.controller");
const {
  protectTenantPrincipal,
  requirePermission,
} = require("../../middleware/auth");

const route = (path, permission, handler) =>
  router.get(path, protectTenantPrincipal, requirePermission(permission), handler);

// ─── 15.2 Asset Models ─────────────────────────────────────────────────

route("/model-categories", "itsm.asset.model_category.read", ctrl.listModelCategories);
router.post("/model-categories", protectTenantPrincipal, requirePermission("itsm.asset.model_category.create"), ctrl.createModelCategory);
router.put("/model-categories/:id", protectTenantPrincipal, requirePermission("itsm.asset.model_category.update"), ctrl.updateModelCategory);
router.delete("/model-categories/:id", protectTenantPrincipal, requirePermission("itsm.asset.model_category.delete"), ctrl.deleteModelCategory);

route("/models", "itsm.asset.asset_model.read", ctrl.listModels);
route("/models/:id", "itsm.asset.asset_model.read", ctrl.getModel);
router.post("/models", protectTenantPrincipal, requirePermission("itsm.asset.asset_model.create"), ctrl.createModel);
router.put("/models/:id", protectTenantPrincipal, requirePermission("itsm.asset.asset_model.update"), ctrl.updateModel);
router.delete("/models/:id", protectTenantPrincipal, requirePermission("itsm.asset.asset_model.delete"), ctrl.deleteModel);

// ─── 15.3 Stockrooms ───────────────────────────────────────────────────

route("/stockrooms", "itsm.asset.stockroom.read", ctrl.listStockrooms);
route("/stockrooms/:id", "itsm.asset.stockroom.read", ctrl.getStockroom);
router.post("/stockrooms", protectTenantPrincipal, requirePermission("itsm.asset.stockroom.create"), ctrl.createStockroom);
router.put("/stockrooms/:id", protectTenantPrincipal, requirePermission("itsm.asset.stockroom.update"), ctrl.updateStockroom);
router.delete("/stockrooms/:id", protectTenantPrincipal, requirePermission("itsm.asset.stockroom.delete"), ctrl.deleteStockroom);

// ─── 15.4 Inventory ────────────────────────────────────────────────────

route("/inventory", "itsm.asset.inventory.read", ctrl.listBalances);
router.post("/inventory", protectTenantPrincipal, requirePermission("itsm.asset.inventory_balance.update"), ctrl.createBalance);
router.put("/inventory/:id", protectTenantPrincipal, requirePermission("itsm.asset.inventory_balance.update"), ctrl.updateBalance);
route("/inventory/overview", "itsm.asset.inventory.read", ctrl.inventoryOverview);
route("/inventory/exceptions", "itsm.asset.inventory_exception.read", ctrl.listInventoryExceptions);
router.post("/inventory/exceptions", protectTenantPrincipal, requirePermission("itsm.asset.inventory_exception.update"), ctrl.createInventoryException);
router.put("/inventory/exceptions/:id", protectTenantPrincipal, requirePermission("itsm.asset.inventory_exception.update"), ctrl.updateInventoryException);
route("/stockrooms/:id/inventory", "itsm.asset.stockroom_inventory.read", ctrl.listStockroomInventory);
router.put("/stockrooms/:id/inventory/:balanceId", protectTenantPrincipal, requirePermission("itsm.asset.stockroom_inventory.update"), ctrl.setStockroomBalance);

// ─── 15.5 Transfers ────────────────────────────────────────────────────

route("/transfers", "itsm.asset.transfer.read", ctrl.listTransfers);
route("/transfers/:id", "itsm.asset.transfer.read", ctrl.getTransfer);
router.post("/transfers", protectTenantPrincipal, requirePermission("itsm.asset.transfer.create"), ctrl.createTransfer);
router.put("/transfers/:id", protectTenantPrincipal, requirePermission("itsm.asset.transfer.update"), ctrl.updateTransfer);
router.delete("/transfers/:id", protectTenantPrincipal, requirePermission("itsm.asset.transfer.delete"), ctrl.deleteTransfer);
route("/transfers/:id/lines", "itsm.asset.transfer_line.read", ctrl.listTransferLines);
router.post("/transfers/:id/lines", protectTenantPrincipal, requirePermission("itsm.asset.transfer_line.create"), ctrl.createTransferLine);
router.put("/transfers/:id/lines/:lineId", protectTenantPrincipal, requirePermission("itsm.asset.transfer_line.update"), ctrl.updateTransferLine);
router.delete("/transfers/:id/lines/:lineId", protectTenantPrincipal, requirePermission("itsm.asset.transfer_line.delete"), ctrl.deleteTransferLine);
router.post("/transfers/:id/request", protectTenantPrincipal, requirePermission("itsm.asset.transfer.update"), ctrl.requestTransfer);
router.post("/transfers/:id/ship", protectTenantPrincipal, requirePermission("itsm.asset.state.ship_transfer"), ctrl.shipTransfer);
router.post("/transfers/:id/receive", protectTenantPrincipal, requirePermission("itsm.asset.state.receive_transfer"), ctrl.receiveTransfer);
router.post("/transfers/:id/cancel", protectTenantPrincipal, requirePermission("itsm.asset.state.cancel_transfer"), ctrl.cancelTransfer);

// ─── 15.6 Asset Assignment ─────────────────────────────────────────────

route("/assignments", "itsm.asset.asset_assignment.read", ctrl.listAssignments);
router.post("/assignments", protectTenantPrincipal, requirePermission("itsm.asset.state.assign_asset"), ctrl.createAssignment);
router.put("/assignments/:id", protectTenantPrincipal, requirePermission("itsm.asset.asset_assignment.update"), ctrl.updateAssignment);
router.delete("/assignments/:id", protectTenantPrincipal, requirePermission("itsm.asset.asset_assignment.delete"), ctrl.deleteAssignment);
router.post("/assignments/:id/return", protectTenantPrincipal, requirePermission("itsm.asset.state.return_asset"), ctrl.returnAsset);
router.post("/assignments/:id/swap", protectTenantPrincipal, requirePermission("itsm.asset.state.swap_asset"), ctrl.swapAsset);

// ─── 15.7 Asset Lifecycle ──────────────────────────────────────────────

route("/lifecycle", "itsm.asset.asset_lifecycle.read", ctrl.listLifecycles);
route("/lifecycle/:id", "itsm.asset.asset_lifecycle.read", ctrl.getLifecycle);
const MOVE = {
  in_stock: "itsm.asset.state.move_to_in_stock",
  in_use: "itsm.asset.state.move_to_in_use",
  in_maintenance: "itsm.asset.state.move_to_in_maintenance",
  on_order: "itsm.asset.state.move_to_on_order",
  retired: "itsm.asset.state.move_to_retired",
  disposed: "itsm.asset.state.move_to_disposed",
};
// The target state decides the permission, so the route has to check the body
// before the permission middleware runs.
router.post("/lifecycle/:id/move", protectTenantPrincipal, (req, res, next) => {
  const to = req.body && (req.body.to || req.body.state);
  const key = MOVE[to] || "itsm.asset.state.dispose_asset";
  return requirePermission(key)(req, res, next);
}, ctrl.moveAsset);

// ─── 15.8 Asset Audit ──────────────────────────────────────────────────

route("/audits", "itsm.asset.asset_audit.read", ctrl.listAudits);
route("/audits/:id", "itsm.asset.asset_audit.read", ctrl.getAudit);
router.post("/audits", protectTenantPrincipal, requirePermission("itsm.asset.asset_audit.create"), ctrl.createAudit);
router.put("/audits/:id", protectTenantPrincipal, requirePermission("itsm.asset.asset_audit.update"), ctrl.updateAudit);
router.delete("/audits/:id", protectTenantPrincipal, requirePermission("itsm.asset.asset_audit.delete"), ctrl.deleteAudit);
router.post("/audits/:id/start", protectTenantPrincipal, requirePermission("itsm.asset.state.verify_asset"), ctrl.startAudit);
router.post("/audits/:id/complete", protectTenantPrincipal, requirePermission("itsm.asset.state.verify_asset"), ctrl.completeAudit);
router.post("/audits/:id/cancel", protectTenantPrincipal, requirePermission("itsm.asset.asset_audit.update"), ctrl.cancelAudit);
route("/audits/:id/tasks", "itsm.asset.audit_task.read", ctrl.listAuditTasks);
router.post("/audits/:id/tasks", protectTenantPrincipal, requirePermission("itsm.asset.audit_task.create"), ctrl.createAuditTask);
router.put("/audits/:id/tasks/:taskId", protectTenantPrincipal, requirePermission("itsm.asset.audit_task.update"), ctrl.updateAuditTask);
router.delete("/audits/:id/tasks/:taskId", protectTenantPrincipal, requirePermission("itsm.asset.audit_task.delete"), ctrl.deleteAuditTask);
route("/audits/:id/results", "itsm.asset.audit_result.read", ctrl.listAuditResults);
router.post("/audits/:id/scan", protectTenantPrincipal, requirePermission("itsm.asset.audit_result.create"), ctrl.recordScan);
route("/audit-exceptions", "itsm.asset.audit_exception.read", ctrl.listAuditExceptions);
router.put("/audit-exceptions/:id", protectTenantPrincipal, requirePermission("itsm.asset.audit_exception.update"), ctrl.resolveAuditException);

// ─── 15.9 Cost Management ──────────────────────────────────────────────

route("/cost-centers", "itsm.asset.cost_center.read", ctrl.listCostCenters);
route("/cost-centers/:id", "itsm.asset.cost_center.read", ctrl.getCostCenter);
router.post("/cost-centers", protectTenantPrincipal, requirePermission("itsm.asset.cost_center.create"), ctrl.createCostCenter);
router.put("/cost-centers/:id", protectTenantPrincipal, requirePermission("itsm.asset.cost_center.update"), ctrl.updateCostCenter);
router.delete("/cost-centers/:id", protectTenantPrincipal, requirePermission("itsm.asset.cost_center.delete"), ctrl.deleteCostCenter);
route("/costs", "itsm.asset.cost.read", ctrl.listCosts);
route("/costs/report", "itsm.asset.cost_report.read", ctrl.costReport);
route("/costs/:id", "itsm.asset.cost.read", ctrl.getCost);
router.post("/costs", protectTenantPrincipal, requirePermission("itsm.asset.cost.create"), ctrl.createCost);
router.put("/costs/:id", protectTenantPrincipal, requirePermission("itsm.asset.cost.update"), ctrl.updateCost);
router.delete("/costs/:id", protectTenantPrincipal, requirePermission("itsm.asset.cost.delete"), ctrl.deleteCost);
router.post("/costs/:id/approve", protectTenantPrincipal, requirePermission("itsm.asset.cost.update"), ctrl.approveCost);
router.post("/costs/:id/pay", protectTenantPrincipal, requirePermission("itsm.asset.cost.update"), ctrl.payCost);
route("/costs/:id/allocations", "itsm.asset.cost_allocation.read", ctrl.listCostAllocations);
router.post("/costs/:id/allocations", protectTenantPrincipal, requirePermission("itsm.asset.cost_allocation.create"), ctrl.createCostAllocation);

// ─── 15.10 Configuration ───────────────────────────────────────────────

route("/config/states", "itsm.asset.asset_state.read", ctrl.listAssetStates);
router.post("/config/states", protectTenantPrincipal, requirePermission("itsm.asset.asset_state.create"), ctrl.createAssetState);
router.put("/config/states/:id", protectTenantPrincipal, requirePermission("itsm.asset.asset_state.update"), ctrl.updateAssetState);
router.delete("/config/states/:id", protectTenantPrincipal, requirePermission("itsm.asset.asset_state.delete"), ctrl.deleteAssetState);
route("/config/substates", "itsm.asset.asset_substate.read", ctrl.listAssetSubstates);
router.post("/config/substates", protectTenantPrincipal, requirePermission("itsm.asset.asset_substate.create"), ctrl.createAssetSubstate);
router.put("/config/substates/:id", protectTenantPrincipal, requirePermission("itsm.asset.asset_substate.update"), ctrl.updateAssetSubstate);
router.delete("/config/substates/:id", protectTenantPrincipal, requirePermission("itsm.asset.asset_substate.delete"), ctrl.deleteAssetSubstate);
route("/config/properties", "itsm.asset.asset_property.read", ctrl.listAssetProperties);
router.post("/config/properties", protectTenantPrincipal, requirePermission("itsm.asset.asset_property.create"), ctrl.createAssetProperty);
router.put("/config/properties/:id", protectTenantPrincipal, requirePermission("itsm.asset.asset_property.update"), ctrl.updateAssetProperty);
router.delete("/config/properties/:id", protectTenantPrincipal, requirePermission("itsm.asset.asset_property.delete"), ctrl.deleteAssetProperty);
route("/config/stockrooms/:id", "itsm.asset.stockroom_configuration.read", ctrl.getStockroomConfiguration);
router.put("/config/stockrooms/:id", protectTenantPrincipal, requirePermission("itsm.asset.stockroom_configuration.update"), ctrl.saveStockroomConfiguration);
route("/config/lifecycle-states", "itsm.asset.ui.asset_configuration.access", ctrl.listConfiguredStates);

module.exports = router;
