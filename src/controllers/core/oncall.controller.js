const svc = require('../../services/onCallService');

// ─── Schedules ──────────────────────────────────────────────────────────
exports.listSchedules = async (req, res, next) => { try { res.json({ success: true, data: await svc.listSchedules({ tenantId: req.tenantId }, req.query) }); } catch (e) { next(e); } };
exports.getSchedule = async (req, res, next) => { try { res.json({ success: true, data: await svc.getSchedule({ tenantId: req.tenantId }, req.params.id) }); } catch (e) { next(e); } };
exports.createSchedule = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.createSchedule({ tenantId: req.tenantId }, req.body, req.user) }); } catch (e) { next(e); } };
exports.updateSchedule = async (req, res, next) => { try { res.json({ success: true, data: await svc.updateSchedule({ tenantId: req.tenantId }, req.params.id, req.body, req.user) }); } catch (e) { next(e); } };
exports.deleteSchedule = async (req, res, next) => { try { res.json({ success: true, data: await svc.deleteSchedule({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); } };
exports.publishSchedule = async (req, res, next) => { try { res.json({ success: true, data: await svc.publishSchedule({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); } };

// ─── Shifts ─────────────────────────────────────────────────────────────
exports.listShifts = async (req, res, next) => { try { res.json({ success: true, data: await svc.listShifts({ tenantId: req.tenantId }, req.query) }); } catch (e) { next(e); } };
exports.getShift = async (req, res, next) => { try { res.json({ success: true, data: await svc.getShift({ tenantId: req.tenantId }, req.params.id) }); } catch (e) { next(e); } };
exports.createShift = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.createShift({ tenantId: req.tenantId }, req.body, req.user) }); } catch (e) { next(e); } };
exports.updateShift = async (req, res, next) => { try { res.json({ success: true, data: await svc.updateShift({ tenantId: req.tenantId }, req.params.id, req.body, req.user) }); } catch (e) { next(e); } };
exports.deleteShift = async (req, res, next) => { try { res.json({ success: true, data: await svc.deleteShift({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); } };
exports.completeHandover = async (req, res, next) => { try { res.json({ success: true, data: await svc.completeHandover({ tenantId: req.tenantId }, req.params.id, req.body, req.user) }); } catch (e) { next(e); } };

// ─── Rosters ────────────────────────────────────────────────────────────
exports.listRosters = async (req, res, next) => { try { res.json({ success: true, data: await svc.listRosters({ tenantId: req.tenantId }, req.query) }); } catch (e) { next(e); } };
exports.getRoster = async (req, res, next) => { try { res.json({ success: true, data: await svc.getRoster({ tenantId: req.tenantId }, req.params.id) }); } catch (e) { next(e); } };
exports.createRoster = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.createRoster({ tenantId: req.tenantId }, req.body, req.user) }); } catch (e) { next(e); } };
exports.updateRoster = async (req, res, next) => { try { res.json({ success: true, data: await svc.updateRoster({ tenantId: req.tenantId }, req.params.id, req.body, req.user) }); } catch (e) { next(e); } };
exports.deleteRoster = async (req, res, next) => { try { res.json({ success: true, data: await svc.deleteRoster({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); } };

// ─── Roster Members ────────────────────────────────────────────────────
exports.listRosterMembers = async (req, res, next) => { try { res.json({ success: true, data: await svc.listRosterMembers({ tenantId: req.tenantId }, req.params.rosterId) }); } catch (e) { next(e); } };
exports.addRosterMember = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.addRosterMember({ tenantId: req.tenantId }, req.params.rosterId, req.body, req.user) }); } catch (e) { next(e); } };
exports.removeRosterMember = async (req, res, next) => { try { res.json({ success: true, data: await svc.removeRosterMember({ tenantId: req.tenantId }, req.params.rosterId, req.params.userId) }); } catch (e) { next(e); } };

// ─── Rotations ──────────────────────────────────────────────────────────
exports.listRotations = async (req, res, next) => { try { res.json({ success: true, data: await svc.listRotations({ tenantId: req.tenantId }, req.query) }); } catch (e) { next(e); } };
exports.getRotation = async (req, res, next) => { try { res.json({ success: true, data: await svc.getRotation({ tenantId: req.tenantId }, req.params.id) }); } catch (e) { next(e); } };
exports.createRotation = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.createRotation({ tenantId: req.tenantId }, req.body, req.user) }); } catch (e) { next(e); } };
exports.updateRotation = async (req, res, next) => { try { res.json({ success: true, data: await svc.updateRotation({ tenantId: req.tenantId }, req.params.id, req.body) }); } catch (e) { next(e); } };
exports.deleteRotation = async (req, res, next) => { try { res.json({ success: true, data: await svc.deleteRotation({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); } };
exports.advanceRotation = async (req, res, next) => { try { res.json({ success: true, data: await svc.advanceRotation({ tenantId: req.tenantId }, req.params.id) }); } catch (e) { next(e); } };

// ─── Coverage Requests ─────────────────────────────────────────────────
exports.listCoverageRequests = async (req, res, next) => { try { res.json({ success: true, data: await svc.listCoverageRequests({ tenantId: req.tenantId }, req.query) }); } catch (e) { next(e); } };
exports.getCoverageRequest = async (req, res, next) => { try { res.json({ success: true, data: await svc.getCoverageRequest({ tenantId: req.tenantId }, req.params.id) }); } catch (e) { next(e); } };
exports.createCoverageRequest = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.createCoverageRequest({ tenantId: req.tenantId }, req.body, req.user) }); } catch (e) { next(e); } };
exports.approveCoverageRequest = async (req, res, next) => { try { res.json({ success: true, data: await svc.approveCoverageRequest({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); } };
exports.rejectCoverageRequest = async (req, res, next) => { try { res.json({ success: true, data: await svc.rejectCoverageRequest({ tenantId: req.tenantId }, req.params.id, req.body, req.user) }); } catch (e) { next(e); } };

// ─── Time-Off Requests ─────────────────────────────────────────────────
exports.listTimeOffRequests = async (req, res, next) => { try { res.json({ success: true, data: await svc.listTimeOffRequests({ tenantId: req.tenantId }, req.query) }); } catch (e) { next(e); } };
exports.getTimeOffRequest = async (req, res, next) => { try { res.json({ success: true, data: await svc.getTimeOffRequest({ tenantId: req.tenantId }, req.params.id) }); } catch (e) { next(e); } };
exports.createTimeOffRequest = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.createTimeOffRequest({ tenantId: req.tenantId }, req.body, req.user) }); } catch (e) { next(e); } };
exports.approveTimeOffRequest = async (req, res, next) => { try { res.json({ success: true, data: await svc.approveTimeOffRequest({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); } };
exports.rejectTimeOffRequest = async (req, res, next) => { try { res.json({ success: true, data: await svc.rejectTimeOffRequest({ tenantId: req.tenantId }, req.params.id, req.body, req.user) }); } catch (e) { next(e); } };

// ─── Escalation Policies ────────────────────────────────────────────────
exports.listEscalationPolicies = async (req, res, next) => { try { res.json({ success: true, data: await svc.listEscalationPolicies({ tenantId: req.tenantId }, req.query) }); } catch (e) { next(e); } };
exports.getEscalationPolicy = async (req, res, next) => { try { res.json({ success: true, data: await svc.getEscalationPolicy({ tenantId: req.tenantId }, req.params.id) }); } catch (e) { next(e); } };
exports.createEscalationPolicy = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.createEscalationPolicy({ tenantId: req.tenantId }, req.body, req.user) }); } catch (e) { next(e); } };
exports.updateEscalationPolicy = async (req, res, next) => { try { res.json({ success: true, data: await svc.updateEscalationPolicy({ tenantId: req.tenantId }, req.params.id, req.body) }); } catch (e) { next(e); } };
exports.deleteEscalationPolicy = async (req, res, next) => { try { res.json({ success: true, data: await svc.deleteEscalationPolicy({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); } };

// ─── Escalation Levels ──────────────────────────────────────────────────
exports.listEscalationLevels = async (req, res, next) => { try { res.json({ success: true, data: await svc.listEscalationLevels({ tenantId: req.tenantId }, req.params.policyId) }); } catch (e) { next(e); } };
exports.createEscalationLevel = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.createEscalationLevel({ tenantId: req.tenantId }, req.params.policyId, req.body) }); } catch (e) { next(e); } };
exports.updateEscalationLevel = async (req, res, next) => { try { res.json({ success: true, data: await svc.updateEscalationLevel({ tenantId: req.tenantId }, req.params.id, req.body) }); } catch (e) { next(e); } };
exports.deleteEscalationLevel = async (req, res, next) => { try { res.json({ success: true, data: await svc.deleteEscalationLevel({ tenantId: req.tenantId }, req.params.id) }); } catch (e) { next(e); } };

// ─── Contact Preferences ────────────────────────────────────────────────
exports.getContactPreference = async (req, res, next) => { try { res.json({ success: true, data: await svc.getContactPreference({ tenantId: req.tenantId }, req.params.userId) }); } catch (e) { next(e); } };
exports.updateContactPreference = async (req, res, next) => { try { res.json({ success: true, data: await svc.updateContactPreference({ tenantId: req.tenantId }, req.params.userId, req.body) }); } catch (e) { next(e); } };

// ─── Current On-Call ────────────────────────────────────────────────────
exports.getCurrentOnCall = async (req, res, next) => { try { res.json({ success: true, data: await svc.getCurrentOnCall({ tenantId: req.tenantId }, req.params.scheduleId) }); } catch (e) { next(e); } };
exports.getUpcomingShifts = async (req, res, next) => { try { res.json({ success: true, data: await svc.getUpcomingShifts({ tenantId: req.tenantId }, req.params.scheduleId, parseInt(req.query.days) || 7) }); } catch (e) { next(e); } };
exports.getOnCallAgentForTeam = async (req, res, next) => { try { res.json({ success: true, data: await svc.getOnCallAgentForTeam({ tenantId: req.tenantId }, req.params.teamId) }); } catch (e) { next(e); } };

// ─── Gap Detection ──────────────────────────────────────────────────────
exports.detectGaps = async (req, res, next) => { try { res.json({ success: true, data: await svc.detectGaps({ tenantId: req.tenantId }, req.params.scheduleId, parseInt(req.query.days) || 14) }); } catch (e) { next(e); } };

// ─── Dashboard ──────────────────────────────────────────────────────────
exports.getDashboard = async (req, res, next) => { try { res.json({ success: true, data: await svc.getDashboard({ tenantId: req.tenantId }) }); } catch (e) { next(e); } };

// ─── Job Trigger ────────────────────────────────────────────────────────
exports.notifyUpcomingShifts = async (req, res, next) => { try { res.json({ success: true, data: await svc.notifyUpcomingShifts({ tenantId: req.tenantId }) }); } catch (e) { next(e); } };
