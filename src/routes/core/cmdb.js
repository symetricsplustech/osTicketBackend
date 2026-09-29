const router = require("express").Router();
const ctrl = require("../../controllers/core/cmdb.controller");
const { protectTenantPrincipal, requirePermission } = require("../../middleware/auth");

// ─── Service Portfolio ───────────────────────────────────────────────────
router.get("/portfolios", protectTenantPrincipal, requirePermission("itsm.service_cmdb.service_portfolio.read"), ctrl.listPortfolios);
router.get("/portfolios/:id", protectTenantPrincipal, requirePermission("itsm.service_cmdb.service_portfolio.read"), ctrl.getPortfolio);
router.post("/portfolios", protectTenantPrincipal, requirePermission("itsm.service_cmdb.service_portfolio.create"), ctrl.createPortfolio);
router.put("/portfolios/:id", protectTenantPrincipal, requirePermission("itsm.service_cmdb.service_portfolio.update"), ctrl.updatePortfolio);
router.delete("/portfolios/:id", protectTenantPrincipal, requirePermission("itsm.service_cmdb.service_portfolio.delete"), ctrl.deletePortfolio);

// ─── Business Services ──────────────────────────────────────────────────
router.get(
  "/business-services",
  protectTenantPrincipal, requirePermission("itsm.service_cmdb.business_service.read"),
  ctrl.listBusinessServices,
);
router.get(
  "/business-services/:id",
  protectTenantPrincipal, requirePermission("itsm.service_cmdb.business_service.read"),
  ctrl.getBusinessService,
);
router.post(
  "/business-services",
  protectTenantPrincipal, requirePermission("itsm.service_cmdb.business_service.create"),
  ctrl.createBusinessService,
);
router.put(
  "/business-services/:id",
  protectTenantPrincipal, requirePermission("itsm.service_cmdb.business_service.update"),
  ctrl.updateBusinessService,
);
router.delete(
  "/business-services/:id",
  protectTenantPrincipal, requirePermission("itsm.service_cmdb.business_service.delete"),
  ctrl.deleteBusinessService,
);

// ─── Technical Services ─────────────────────────────────────────────────
router.get(
  "/technical-services",
  protectTenantPrincipal, requirePermission("itsm.service_cmdb.technical_service.read"),
  ctrl.listTechnicalServices,
);
router.get(
  "/technical-services/:id",
  protectTenantPrincipal, requirePermission("itsm.service_cmdb.technical_service.read"),
  ctrl.getTechnicalService,
);
router.post(
  "/technical-services",
  protectTenantPrincipal, requirePermission("itsm.service_cmdb.technical_service.create"),
  ctrl.createTechnicalService,
);
router.put(
  "/technical-services/:id",
  protectTenantPrincipal, requirePermission("itsm.service_cmdb.technical_service.update"),
  ctrl.updateTechnicalService,
);
router.delete(
  "/technical-services/:id",
  protectTenantPrincipal, requirePermission("itsm.service_cmdb.technical_service.delete"),
  ctrl.deleteTechnicalService,
);

// ─── Service Offerings ──────────────────────────────────────────────────
router.get(
  "/service-offerings",
  protectTenantPrincipal, requirePermission("itsm.service_cmdb.service_offering.read"),
  ctrl.listServiceOfferings,
);
router.get(
  "/service-offerings/:id",
  protectTenantPrincipal, requirePermission("itsm.service_cmdb.service_offering.read"),
  ctrl.getServiceOffering,
);
router.post(
  "/service-offerings",
  protectTenantPrincipal, requirePermission("itsm.service_cmdb.service_offering.create"),
  ctrl.createServiceOffering,
);
router.put(
  "/service-offerings/:id",
  protectTenantPrincipal, requirePermission("itsm.service_cmdb.service_offering.update"),
  ctrl.updateServiceOffering,
);
router.delete(
  "/service-offerings/:id",
  protectTenantPrincipal, requirePermission("itsm.service_cmdb.service_offering.delete"),
  ctrl.deleteServiceOffering,
);

// ─── Configuration Items ────────────────────────────────────────────────
router.get("/cis", protectTenantPrincipal, requirePermission("itsm.service_cmdb.configuration_item.read"), ctrl.listCIs);
router.get("/cis/search", protectTenantPrincipal, requirePermission("itsm.service_cmdb.configuration_item.read"), ctrl.searchCIs);
router.get(
  "/cis/non-compliant",
  protectTenantPrincipal, requirePermission("itsm.service_cmdb.configuration_item.read"),
  ctrl.getNonCompliantCIs,
);
router.get("/cis/:id", protectTenantPrincipal, requirePermission("itsm.service_cmdb.configuration_item.read"), ctrl.getCI);
router.post("/cis", protectTenantPrincipal, requirePermission("itsm.service_cmdb.configuration_item.create"), ctrl.createCI);
router.put("/cis/:id", protectTenantPrincipal, requirePermission("itsm.service_cmdb.configuration_item.update"), ctrl.updateCI);
router.delete("/cis/:id", protectTenantPrincipal, requirePermission("itsm.service_cmdb.configuration_item.delete"), ctrl.deleteCI);
router.post("/cis/:id/certify", protectTenantPrincipal, requirePermission("itsm.service_cmdb.configuration_item.update"), ctrl.certifyCI);

// ─── CI Relationships ──────────────────────────────────────────────────
router.get("/relationships", protectTenantPrincipal, requirePermission("itsm.service_cmdb.cirelationship.read"), ctrl.listRelationships);
router.get("/relationships/:id", protectTenantPrincipal, requirePermission("itsm.service_cmdb.cirelationship.read"), ctrl.getRelationship);
router.post("/relationships", protectTenantPrincipal, requirePermission("itsm.service_cmdb.cirelationship.create"), ctrl.createRelationship);
router.put(
  "/relationships/:id",
  protectTenantPrincipal, requirePermission("itsm.service_cmdb.cirelationship.update"),
  ctrl.updateRelationship,
);
router.delete(
  "/relationships/:id",
  protectTenantPrincipal, requirePermission("itsm.service_cmdb.cirelationship.delete"),
  ctrl.deleteRelationship,
);

// ─── Service Owners ────────────────────────────────────────────────────
router.get(
  "/business-services/:serviceId/owners",
  protectTenantPrincipal, requirePermission("itsm.service_cmdb.service_owner.read"),
  ctrl.listServiceOwners,
);
router.post(
  "/business-services/:serviceId/owners",
  protectTenantPrincipal, requirePermission("itsm.service_cmdb.service_owner.create"),
  ctrl.assignServiceOwner,
);
router.delete("/owners/:id", protectTenantPrincipal, requirePermission("itsm.service_cmdb.service_owner.delete"), ctrl.removeServiceOwner);

// ─── Service Commitments ───────────────────────────────────────────────
router.get("/commitments", protectTenantPrincipal, requirePermission("itsm.service_cmdb.service_commitment.read"), ctrl.listServiceCommitments);
router.get(
  "/commitments/:id",
  protectTenantPrincipal, requirePermission("itsm.service_cmdb.service_commitment.read"),
  ctrl.getServiceCommitment,
);
router.post(
  "/commitments",
  protectTenantPrincipal, requirePermission("itsm.service_cmdb.service_commitment.create"),
  ctrl.createServiceCommitment,
);
router.put(
  "/commitments/:id",
  protectTenantPrincipal, requirePermission("itsm.service_cmdb.service_commitment.update"),
  ctrl.updateServiceCommitment,
);
router.delete(
  "/commitments/:id",
  protectTenantPrincipal, requirePermission("itsm.service_cmdb.service_commitment.delete"),
  ctrl.deleteServiceCommitment,
);

// ─── Service Level Commitments ──────────────────────────────────────────
router.get("/slcs", protectTenantPrincipal, requirePermission("itsm.service_cmdb.service_commitment.read"), ctrl.listSLCs);
router.get("/slcs/:id", protectTenantPrincipal, requirePermission("itsm.service_cmdb.service_commitment.read"), ctrl.getSLC);
router.post("/slcs", protectTenantPrincipal, requirePermission("itsm.service_cmdb.service_commitment.create"), ctrl.createSLC);
router.put("/slcs/:id", protectTenantPrincipal, requirePermission("itsm.service_cmdb.service_commitment.update"), ctrl.updateSLC);
router.delete("/slcs/:id", protectTenantPrincipal, requirePermission("itsm.service_cmdb.service_commitment.delete"), ctrl.deleteSLC);

// ─── Dependencies ───────────────────────────────────────────────────────
router.get("/dependencies", protectTenantPrincipal, requirePermission("itsm.service_cmdb.cirelationship.read"), ctrl.listDependencies);
router.get("/dependencies/:id", protectTenantPrincipal, requirePermission("itsm.service_cmdb.cirelationship.read"), ctrl.getDependency);
router.post("/dependencies", protectTenantPrincipal, requirePermission("itsm.service_cmdb.cirelationship.create"), ctrl.createDependency);
router.put("/dependencies/:id", protectTenantPrincipal, requirePermission("itsm.service_cmdb.cirelationship.update"), ctrl.updateDependency);
router.delete(
  "/dependencies/:id",
  protectTenantPrincipal, requirePermission("itsm.service_cmdb.cirelationship.delete"),
  ctrl.deleteDependency,
);

// ─── Impact Analysis ────────────────────────────────────────────────────
router.post("/impact/ci/:ciId", protectTenantPrincipal, requirePermission("itsm.service_cmdb.impact_query_read"), ctrl.analyzeImpact);
router.get(
  "/impact/service/:serviceId",
  protectTenantPrincipal, requirePermission("itsm.service_cmdb.impact_query_read"),
  ctrl.analyzeServiceImpact,
);
router.post(
  "/dependency-graph",
  protectTenantPrincipal, requirePermission("itsm.service_cmdb.dependency_map_read"),
  ctrl.getDependencyGraph,
);

// ─── Dashboard / Search / Compliance ────────────────────────────────────
router.get("/dashboard", protectTenantPrincipal, requirePermission("itsm.service_cmdb.portfolio_read"), ctrl.getDashboard);
router.get("/cis/search", protectTenantPrincipal, requirePermission("itsm.service_cmdb.ci_read"), ctrl.searchCIs);
router.post("/cis/:id/certify", protectTenantPrincipal, requirePermission("itsm.service_cmdb.configuration_item.update"), ctrl.certifyCI);
router.get(
  "/cis/non-compliant",
  protectTenantPrincipal, requirePermission("itsm.service_cmdb.configuration_item.read"),
  ctrl.getNonCompliantCIs,
);

module.exports = router;
