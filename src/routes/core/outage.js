const router = require('express').Router();
const { protectTenantPrincipal, requirePermission } = require('../../middleware/auth');

// Make sure model schemas are registered before the controller/service uses
// them. Direct requires ensure schemas are loaded.
require('../../models/outage/Outage');
require('../../models/outage/OutageCI');
require('../../models/outage/OutageService');
require('../../models/outage/AvailabilityRecord');

const ctrl = require('../../controllers/core/outage.controller');

// ─── Outages ───────────────────────────────────────────────────────────
router.get('/outages', protectTenantPrincipal, requirePermission("itsm.outage.outage.read"), ctrl.listOutages);
router.get('/outages/:id', protectTenantPrincipal, requirePermission("itsm.outage.outage.read"), ctrl.getOutage);
router.get('/outages/:id/detail', protectTenantPrincipal, requirePermission("itsm.outage.outage.read"), ctrl.getOutageDetail);
router.post('/outages', protectTenantPrincipal, requirePermission("itsm.outage.outage.create"), ctrl.createOutage);
router.put('/outages/:id', protectTenantPrincipal, requirePermission("itsm.outage.outage.update"), ctrl.updateOutage);
router.post('/outages/:id/transition', protectTenantPrincipal, requirePermission("itsm.outage.outage.update"), ctrl.transitionOutage);
router.delete('/outages/:id', protectTenantPrincipal, requirePermission("itsm.outage.outage.delete"), ctrl.deleteOutage);

// ─── CI Associations ───────────────────────────────────────────────────
router.get('/outages/:outageId/cis', protectTenantPrincipal, requirePermission("itsm.outage.outage_ci.read"), ctrl.listOutageCIs);
router.post('/outages/:outageId/cis', protectTenantPrincipal, requirePermission("itsm.outage.outage_ci.create"), ctrl.addOutageCI);
router.delete('/outages/:outageId/cis/:ciId', protectTenantPrincipal, requirePermission("itsm.outage.outage_ci.delete"), ctrl.removeOutageCI);
router.put('/outages/:outageId/cis/:ciId', protectTenantPrincipal, requirePermission("itsm.outage.outage_ci.update"), ctrl.updateOutageCI);

// ─── Service Associations ─────────────────────────────────────────────
router.get('/outages/:outageId/services', protectTenantPrincipal, requirePermission("itsm.outage.outage_service.read"), ctrl.listOutageServices);
router.post('/outages/:outageId/services', protectTenantPrincipal, requirePermission("itsm.outage.outage_service.create"), ctrl.addOutageService);
router.put('/outages/:outageId/services/:serviceId', protectTenantPrincipal, requirePermission("itsm.outage.outage_service.update"), ctrl.updateOutageService);
router.delete('/outages/:outageId/services/:serviceId', protectTenantPrincipal, requirePermission("itsm.outage.outage_service.delete"), ctrl.removeOutageService);

// ─── Timeline ──────────────────────────────────────────────────────────
router.post('/outages/:outageId/timeline', protectTenantPrincipal, requirePermission("itsm.outage.outage.update"), ctrl.addTimelineEntry);
router.get('/outages/:outageId/timeline', protectTenantPrincipal, requirePermission("itsm.outage.outage.read"), ctrl.getTimeline);

// ─── Communication ────────────────────────────────────────────────────
router.put('/outages/:outageId/communication-plan', protectTenantPrincipal, requirePermission("itsm.outage.outage.update"), ctrl.updateCommunicationPlan);
router.post('/outages/:outageId/communication', protectTenantPrincipal, requirePermission("itsm.outage.outage.update"), ctrl.recordCommunication);

// ─── Related Incidents/Changes ────────────────────────────────────────
// 16.3 relationship keys already exist in the catalog; reading the whole set
// rides on the outage read permission, and unlinking is a mutation on the
// outage, matching the timeline and communication-plan routes below.
router.get('/outages/:outageId/relations', protectTenantPrincipal, requirePermission("itsm.outage.outage.read"), ctrl.listRelations);
router.delete('/outages/:outageId/relations/:relationId', protectTenantPrincipal, requirePermission("itsm.outage.outage.update"), ctrl.removeRelation);
router.post('/outages/:outageId/incidents', protectTenantPrincipal, requirePermission("itsm.outage.link_incident"), ctrl.associateIncident);
router.post('/outages/:outageId/major-incident', protectTenantPrincipal, requirePermission("itsm.outage.link_incident"), ctrl.associateMajorIncident);
router.post('/outages/:outageId/changes', protectTenantPrincipal, requirePermission("itsm.outage.link_change"), ctrl.associateChange);

// ─── Availability ─────────────────────────────────────────────────────
router.post('/availability/calculate', protectTenantPrincipal, requirePermission("itsm.outage.availability_read"), ctrl.calculateAvailability);
router.get('/availability/records', protectTenantPrincipal, requirePermission("itsm.outage.availability_read"), ctrl.getAvailabilityRecords);
router.get('/availability/services/:serviceId', protectTenantPrincipal, requirePermission("itsm.outage.availability_read"), ctrl.getServiceAvailability);

// ─── Dashboard ────────────────────────────────────────────────────────
router.get('/dashboard', protectTenantPrincipal, requirePermission("itsm.outage.outage.read"), ctrl.getDashboard);

// ─── Job Trigger ──────────────────────────────────────────────────────
router.post('/communication-cadence', protectTenantPrincipal, requirePermission("itsm.outage.automation.status_publication.manage"), ctrl.processCommunicationCadence);

module.exports = router;
