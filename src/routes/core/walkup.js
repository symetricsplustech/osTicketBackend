const router = require('express').Router();
const ctrl = require('../../controllers/core/walkup.controller');
const { protectTenantPrincipal } = require('../../middleware/auth');

// ─── Locations ──────────────────────────────────────────────────────────
router.get('/locations', protectTenantPrincipal, ctrl.listLocations);
router.get('/locations/open', protectTenantPrincipal, ctrl.getOpenLocations);
router.get('/locations/:id', protectTenantPrincipal, ctrl.getLocation);
router.post('/locations', protectTenantPrincipal, ctrl.createLocation);
router.put('/locations/:id', protectTenantPrincipal, ctrl.updateLocation);
router.delete('/locations/:id', protectTenantPrincipal, ctrl.deleteLocation);

// ─── Services ──────────────────────────────────────────────────────────
router.get('/services', protectTenantPrincipal, ctrl.listServices);
router.get('/services/:id', protectTenantPrincipal, ctrl.getService);
router.post('/services', protectTenantPrincipal, ctrl.createService);
router.put('/services/:id', protectTenantPrincipal, ctrl.updateService);
router.delete('/services/:id', protectTenantPrincipal, ctrl.deleteService);

// ─── Queues ────────────────────────────────────────────────────────────
router.get('/queues', protectTenantPrincipal, ctrl.listQueues);
router.get('/queues/:id', protectTenantPrincipal, ctrl.getQueue);
router.post('/queues', protectTenantPrincipal, ctrl.createQueue);
router.put('/queues/:id', protectTenantPrincipal, ctrl.updateQueue);
router.delete('/queues/:id', protectTenantPrincipal, ctrl.deleteQueue);

// ─── Check-ins ─────────────────────────────────────────────────────────
router.post('/checkin', protectTenantPrincipal, ctrl.checkIn);
router.post('/checkin/:id/call', protectTenantPrincipal, ctrl.callCheckin);
router.post('/checkin/:id/start', protectTenantPrincipal, ctrl.startService);
router.post('/checkin/:id/complete', protectTenantPrincipal, ctrl.completeCheckin);
router.post('/checkin/:id/cancel', protectTenantPrincipal, ctrl.cancelCheckin);

// ─── Appointments ──────────────────────────────────────────────────────
router.get('/appointments', protectTenantPrincipal, ctrl.listAppointments);
router.get('/appointments/:id', protectTenantPrincipal, ctrl.getAppointment);
router.post('/appointments', protectTenantPrincipal, ctrl.createAppointment);
router.put('/appointments/:id', protectTenantPrincipal, ctrl.updateAppointment);
router.post('/appointments/:id/checkin', protectTenantPrincipal, ctrl.checkinAppointment);
router.post('/appointments/:id/cancel', protectTenantPrincipal, ctrl.cancelAppointment);

// ─── Interactions ──────────────────────────────────────────────────────
router.post('/interactions', protectTenantPrincipal, ctrl.createInteraction);
router.get('/interactions/:id', protectTenantPrincipal, ctrl.getInteraction);

// ─── Kiosks ────────────────────────────────────────────────────────────
router.get('/kiosks', protectTenantPrincipal, ctrl.listKiosks);
router.get('/kiosks/:id', protectTenantPrincipal, ctrl.getKiosk);
router.post('/kiosks', protectTenantPrincipal, ctrl.createKiosk);
router.put('/kiosks/:id', protectTenantPrincipal, ctrl.updateKiosk);
router.delete('/kiosks/:id', protectTenantPrincipal, ctrl.deleteKiosk);
router.post('/kiosks/:id/heartbeat', protectTenantPrincipal, ctrl.heartbeat);

// ─── Wait Time ─────────────────────────────────────────────────────────
router.post('/queues/:queueId/wait-time', protectTenantPrincipal, ctrl.recordWaitTime);
router.get('/queues/:queueId/wait-time', protectTenantPrincipal, ctrl.getWaitTimeEstimate);

// ─── Dashboard ─────────────────────────────────────────────────────────
router.get('/dashboard', protectTenantPrincipal, ctrl.getDashboard);

module.exports = router;
