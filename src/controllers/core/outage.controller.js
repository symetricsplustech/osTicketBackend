const svc = require('../../services/outageService');

// ─── Outages ───────────────────────────────────────────────────────────
exports.listOutages = async (req, res, next) => { try { res.json({ success: true, data: await svc.listOutages({ tenantId: req.tenantId }, req.query) }); } catch (e) { next(e); } };
exports.getOutage = async (req, res, next) => { try { res.json({ success: true, data: await svc.getOutage({ tenantId: req.tenantId }, req.params.id) }); } catch (e) { next(e); } };
exports.getOutageDetail = async (req, res, next) => { try { res.json({ success: true, data: await svc.getOutageWithDetails({ tenantId: req.tenantId }, req.params.id) }); } catch (e) { next(e); } };
exports.createOutage = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.createOutage({ tenantId: req.tenantId }, req.body, req.user) }); } catch (e) { next(e); } };
exports.updateOutage = async (req, res, next) => { try { res.json({ success: true, data: await svc.updateOutage({ tenantId: req.tenantId }, req.params.id, req.body, req.user) }); } catch (e) { next(e); } };
exports.transitionOutage = async (req, res, next) => { try { res.json({ success: true, data: await svc.transitionOutage({ tenantId: req.tenantId }, req.params.id, req.body.status, req.user) }); } catch (e) { next(e); } };
exports.deleteOutage = async (req, res, next) => { try { res.json({ success: true, data: await svc.deleteOutage({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); } };

// ─── CI Associations ───────────────────────────────────────────────────
exports.listOutageCIs = async (req, res, next) => { try { res.json({ success: true, data: await svc.listOutageCIs({ tenantId: req.tenantId }, req.params.outageId) }); } catch (e) { next(e); } };
exports.addOutageCI = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.addOutageCI({ tenantId: req.tenantId }, req.params.outageId, req.body, req.user) }); } catch (e) { next(e); } };
exports.removeOutageCI = async (req, res, next) => { try { res.json({ success: true, data: await svc.removeOutageCI({ tenantId: req.tenantId }, req.params.outageId, req.params.ciId) }); } catch (e) { next(e); } };
exports.updateOutageCI = async (req, res, next) => { try { res.json({ success: true, data: await svc.updateOutageCI({ tenantId: req.tenantId }, req.params.outageId, req.params.ciId, req.body) }); } catch (e) { next(e); } };

// ─── Service Associations ─────────────────────────────────────────────
exports.listOutageServices = async (req, res, next) => { try { res.json({ success: true, data: await svc.listOutageServices({ tenantId: req.tenantId }, req.params.outageId) }); } catch (e) { next(e); } };
exports.addOutageService = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.addOutageService({ tenantId: req.tenantId }, req.params.outageId, req.body, req.user) }); } catch (e) { next(e); } };
exports.updateOutageService = async (req, res, next) => { try { res.json({ success: true, data: await svc.updateOutageService({ tenantId: req.tenantId }, req.params.outageId, req.params.serviceId, req.body) }); } catch (e) { next(e); } };
exports.removeOutageService = async (req, res, next) => { try { res.json({ success: true, data: await svc.removeOutageService({ tenantId: req.tenantId }, req.params.outageId, req.params.serviceId) }); } catch (e) { next(e); } };

// ─── Timeline ──────────────────────────────────────────────────────────
exports.addTimelineEntry = async (req, res, next) => { try { res.json({ success: true, data: await svc.addTimelineEntry({ tenantId: req.tenantId }, req.params.outageId, req.body, req.user) }); } catch (e) { next(e); } };
exports.getTimeline = async (req, res, next) => { try { res.json({ success: true, data: await svc.getTimeline({ tenantId: req.tenantId }, req.params.outageId) }); } catch (e) { next(e); } };

// ─── Communication ────────────────────────────────────────────────────
exports.updateCommunicationPlan = async (req, res, next) => { try { res.json({ success: true, data: await svc.updateCommunicationPlan({ tenantId: req.tenantId }, req.params.outageId, req.body) }); } catch (e) { next(e); } };
exports.recordCommunication = async (req, res, next) => { try { res.json({ success: true, data: await svc.recordCommunication({ tenantId: req.tenantId }, req.params.outageId, req.body, req.user) }); } catch (e) { next(e); } };

// ─── Related Incidents/Changes ────────────────────────────────────────
exports.associateIncident = async (req, res, next) => { try { res.json({ success: true, data: await svc.associateIncident({ tenantId: req.tenantId }, req.params.outageId, req.body.incidentId) }); } catch (e) { next(e); } };
exports.associateChange = async (req, res, next) => { try { res.json({ success: true, data: await svc.associateChange({ tenantId: req.tenantId }, req.params.outageId, req.body.changeId) }); } catch (e) { next(e); } };

// ─── Availability ─────────────────────────────────────────────────────
exports.calculateAvailability = async (req, res, next) => { try { res.json({ success: true, data: await svc.calculateAvailability({ tenantId: req.tenantId }, req.body.entityType, req.body.entityId, req.body.periodStart, req.body.periodEnd) }); } catch (e) { next(e); } };
exports.getAvailabilityRecords = async (req, res, next) => { try { res.json({ success: true, data: await svc.getAvailabilityRecords({ tenantId: req.tenantId }, req.query) }); } catch (e) { next(e); } };
exports.getServiceAvailability = async (req, res, next) => { try { res.json({ success: true, data: await svc.getServiceAvailability({ tenantId: req.tenantId }, req.params.serviceId, req.query.periodStart, req.query.periodEnd) }); } catch (e) { next(e); } };

// ─── Dashboard ────────────────────────────────────────────────────────
exports.getDashboard = async (req, res, next) => { try { res.json({ success: true, data: await svc.getDashboard({ tenantId: req.tenantId }) }); } catch (e) { next(e); } };

// ─── Job Trigger ──────────────────────────────────────────────────────
exports.processCommunicationCadence = async (req, res, next) => { try { res.json({ success: true, data: await svc.processCommunicationCadence({ tenantId: req.tenantId }) }); } catch (e) { next(e); } };
