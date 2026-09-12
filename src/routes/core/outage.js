const router = require('express').Router();
const { protectTenantPrincipal } = require('../../middleware/auth');

// Make sure model schemas are registered before the controller/service uses
// `mongoose.model(name)`. Guarded against double re-registration.
const mongoose = require('mongoose');
for (const m of ['../../models/outage/Outage', '../../models/outage/OutageCI', '../../models/outage/OutageService', '../../models/outage/AvailabilityRecord']) {
  if (!mongoose.models[require('path').basename(m)]) require(m);
}

const ctrl = require('../../controllers/core/outage.controller');

// ─── Outages ───────────────────────────────────────────────────────────
router.get('/outages', protectTenantPrincipal, ctrl.listOutages);
router.get('/outages/:id', protectTenantPrincipal, ctrl.getOutage);
router.get('/outages/:id/detail', protectTenantPrincipal, ctrl.getOutageDetail);
router.post('/outages', protectTenantPrincipal, ctrl.createOutage);
router.put('/outages/:id', protectTenantPrincipal, ctrl.updateOutage);
router.post('/outages/:id/transition', protectTenantPrincipal, ctrl.transitionOutage);
router.delete('/outages/:id', protectTenantPrincipal, ctrl.deleteOutage);

// ─── CI Associations ───────────────────────────────────────────────────
router.get('/outages/:outageId/cis', protectTenantPrincipal, ctrl.listOutageCIs);
router.post('/outages/:outageId/cis', protectTenantPrincipal, ctrl.addOutageCI);
router.delete('/outages/:outageId/cis/:ciId', protectTenantPrincipal, ctrl.removeOutageCI);
router.put('/outages/:outageId/cis/:ciId', protectTenantPrincipal, ctrl.updateOutageCI);

// ─── Service Associations ─────────────────────────────────────────────
router.get('/outages/:outageId/services', protectTenantPrincipal, ctrl.listOutageServices);
router.post('/outages/:outageId/services', protectTenantPrincipal, ctrl.addOutageService);
router.put('/outages/:outageId/services/:serviceId', protectTenantPrincipal, ctrl.updateOutageService);
router.delete('/outages/:outageId/services/:serviceId', protectTenantPrincipal, ctrl.removeOutageService);

// ─── Timeline ──────────────────────────────────────────────────────────
router.post('/outages/:outageId/timeline', protectTenantPrincipal, ctrl.addTimelineEntry);
router.get('/outages/:outageId/timeline', protectTenantPrincipal, ctrl.getTimeline);

// ─── Communication ────────────────────────────────────────────────────
router.put('/outages/:outageId/communication-plan', protectTenantPrincipal, ctrl.updateCommunicationPlan);
router.post('/outages/:outageId/communication', protectTenantPrincipal, ctrl.recordCommunication);

// ─── Related Incidents/Changes ────────────────────────────────────────
router.post('/outages/:outageId/incidents', protectTenantPrincipal, ctrl.associateIncident);
router.post('/outages/:outageId/changes', protectTenantPrincipal, ctrl.associateChange);

// ─── Availability ─────────────────────────────────────────────────────
router.post('/availability/calculate', protectTenantPrincipal, ctrl.calculateAvailability);
router.get('/availability/records', protectTenantPrincipal, ctrl.getAvailabilityRecords);
router.get('/availability/services/:serviceId', protectTenantPrincipal, ctrl.getServiceAvailability);

// ─── Dashboard ────────────────────────────────────────────────────────
router.get('/dashboard', protectTenantPrincipal, ctrl.getDashboard);

// ─── Job Trigger ──────────────────────────────────────────────────────
router.post('/communication-cadence', protectTenantPrincipal, ctrl.processCommunicationCadence);

module.exports = router;
