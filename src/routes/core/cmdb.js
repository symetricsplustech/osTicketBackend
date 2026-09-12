const router = require("express").Router();
const ctrl = require("../../controllers/core/cmdb.controller");
const { protectTenantPrincipal } = require("../../middleware/auth");

// ─── Service Portfolio ───────────────────────────────────────────────────
router.get("/portfolios", protectTenantPrincipal, ctrl.listPortfolios);
router.get("/portfolios/:id", protectTenantPrincipal, ctrl.getPortfolio);
router.post("/portfolios", protectTenantPrincipal, ctrl.createPortfolio);
router.put("/portfolios/:id", protectTenantPrincipal, ctrl.updatePortfolio);
router.delete("/portfolios/:id", protectTenantPrincipal, ctrl.deletePortfolio);

// ─── Business Services ──────────────────────────────────────────────────
router.get(
  "/business-services",
  protectTenantPrincipal,
  ctrl.listBusinessServices,
);
router.get(
  "/business-services/:id",
  protectTenantPrincipal,
  ctrl.getBusinessService,
);
router.post(
  "/business-services",
  protectTenantPrincipal,
  ctrl.createBusinessService,
);
router.put(
  "/business-services/:id",
  protectTenantPrincipal,
  ctrl.updateBusinessService,
);
router.delete(
  "/business-services/:id",
  protectTenantPrincipal,
  ctrl.deleteBusinessService,
);

// ─── Technical Services ─────────────────────────────────────────────────
router.get(
  "/technical-services",
  protectTenantPrincipal,
  ctrl.listTechnicalServices,
);
router.get(
  "/technical-services/:id",
  protectTenantPrincipal,
  ctrl.getTechnicalService,
);
router.post(
  "/technical-services",
  protectTenantPrincipal,
  ctrl.createTechnicalService,
);
router.put(
  "/technical-services/:id",
  protectTenantPrincipal,
  ctrl.updateTechnicalService,
);
router.delete(
  "/technical-services/:id",
  protectTenantPrincipal,
  ctrl.deleteTechnicalService,
);

// ─── Service Offerings ──────────────────────────────────────────────────
router.get(
  "/service-offerings",
  protectTenantPrincipal,
  ctrl.listServiceOfferings,
);
router.get(
  "/service-offerings/:id",
  protectTenantPrincipal,
  ctrl.getServiceOffering,
);
router.post(
  "/service-offerings",
  protectTenantPrincipal,
  ctrl.createServiceOffering,
);
router.put(
  "/service-offerings/:id",
  protectTenantPrincipal,
  ctrl.updateServiceOffering,
);
router.delete(
  "/service-offerings/:id",
  protectTenantPrincipal,
  ctrl.deleteServiceOffering,
);

// ─── Configuration Items ────────────────────────────────────────────────
router.get("/cis", protectTenantPrincipal, ctrl.listCIs);
router.get("/cis/search", protectTenantPrincipal, ctrl.searchCIs);
router.get(
  "/cis/non-compliant",
  protectTenantPrincipal,
  ctrl.getNonCompliantCIs,
);
router.get("/cis/:id", protectTenantPrincipal, ctrl.getCI);
router.post("/cis", protectTenantPrincipal, ctrl.createCI);
router.put("/cis/:id", protectTenantPrincipal, ctrl.updateCI);
router.delete("/cis/:id", protectTenantPrincipal, ctrl.deleteCI);
router.post("/cis/:id/certify", protectTenantPrincipal, ctrl.certifyCI);

// ─── CI Relationships ──────────────────────────────────────────────────
router.get("/relationships", protectTenantPrincipal, ctrl.listRelationships);
router.get("/relationships/:id", protectTenantPrincipal, ctrl.getRelationship);
router.post("/relationships", protectTenantPrincipal, ctrl.createRelationship);
router.put(
  "/relationships/:id",
  protectTenantPrincipal,
  ctrl.updateRelationship,
);
router.delete(
  "/relationships/:id",
  protectTenantPrincipal,
  ctrl.deleteRelationship,
);

// ─── Service Owners ────────────────────────────────────────────────────
router.get(
  "/business-services/:serviceId/owners",
  protectTenantPrincipal,
  ctrl.listServiceOwners,
);
router.post(
  "/business-services/:serviceId/owners",
  protectTenantPrincipal,
  ctrl.assignServiceOwner,
);
router.delete("/owners/:id", protectTenantPrincipal, ctrl.removeServiceOwner);

// ─── Service Commitments ───────────────────────────────────────────────
router.get("/commitments", protectTenantPrincipal, ctrl.listServiceCommitments);
router.get(
  "/commitments/:id",
  protectTenantPrincipal,
  ctrl.getServiceCommitment,
);
router.post(
  "/commitments",
  protectTenantPrincipal,
  ctrl.createServiceCommitment,
);
router.put(
  "/commitments/:id",
  protectTenantPrincipal,
  ctrl.updateServiceCommitment,
);
router.delete(
  "/commitments/:id",
  protectTenantPrincipal,
  ctrl.deleteServiceCommitment,
);

// ─── Service Level Commitments ──────────────────────────────────────────
router.get("/slcs", protectTenantPrincipal, ctrl.listSLCs);
router.get("/slcs/:id", protectTenantPrincipal, ctrl.getSLC);
router.post("/slcs", protectTenantPrincipal, ctrl.createSLC);
router.put("/slcs/:id", protectTenantPrincipal, ctrl.updateSLC);
router.delete("/slcs/:id", protectTenantPrincipal, ctrl.deleteSLC);

// ─── Dependencies ───────────────────────────────────────────────────────
router.get("/dependencies", protectTenantPrincipal, ctrl.listDependencies);
router.get("/dependencies/:id", protectTenantPrincipal, ctrl.getDependency);
router.post("/dependencies", protectTenantPrincipal, ctrl.createDependency);
router.put("/dependencies/:id", protectTenantPrincipal, ctrl.updateDependency);
router.delete(
  "/dependencies/:id",
  protectTenantPrincipal,
  ctrl.deleteDependency,
);

// ─── Impact Analysis ────────────────────────────────────────────────────
router.post("/impact/ci/:ciId", protectTenantPrincipal, ctrl.analyzeImpact);
router.get(
  "/impact/service/:serviceId",
  protectTenantPrincipal,
  ctrl.analyzeServiceImpact,
);
router.post(
  "/dependency-graph",
  protectTenantPrincipal,
  ctrl.getDependencyGraph,
);

// ─── Dashboard / Search / Compliance ────────────────────────────────────
router.get("/dashboard", protectTenantPrincipal, ctrl.getDashboard);
router.get("/cis/search", protectTenantPrincipal, ctrl.searchCIs);
router.post("/cis/:id/certify", protectTenantPrincipal, ctrl.certifyCI);
router.get(
  "/cis/non-compliant",
  protectTenantPrincipal,
  ctrl.getNonCompliantCIs,
);

module.exports = router;
