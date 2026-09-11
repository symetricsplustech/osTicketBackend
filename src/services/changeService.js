const Change = require('../models/helpdesk/incidents/Change');
const ChangeTask = require('../models/helpdesk/incidents/ChangeTask');
const ChangeCI = require('../models/helpdesk/incidents/ChangeCI');
const ChangeService = require('../models/helpdesk/incidents/ChangeService');
const ChangeRiskAssessment = require('../models/helpdesk/incidents/ChangeRiskAssessment');
const ChangeConflict = require('../models/helpdesk/incidents/ChangeConflict');
const ChangeImplementationResult = require('../models/helpdesk/incidents/ChangeImplementationResult');
const ChangeModel = require('../models/helpdesk/incidents/ChangeModel');
const StandardChangeTemplate = require('../models/helpdesk/incidents/StandardChangeTemplate');
const MaintenanceWindow = require('../models/helpdesk/incidents/MaintenanceWindow');
const BlackoutWindow = require('../models/helpdesk/incidents/BlackoutWindow');
const ChangeApprovalPolicy = require('../models/helpdesk/incidents/ChangeApprovalPolicy');
const CABDefinition = require('../models/helpdesk/incidents/CABDefinition');
const CABMeeting = require('../models/helpdesk/incidents/CABMeeting');
const CABAgendaItem = require('../models/helpdesk/incidents/CABAgendaItem');
const CABAttendee = require('../models/helpdesk/incidents/CABAttendee');
const ApiError = require('../utils/ApiError');
const { assertTransition } = require('./stateMachine.service');
const events = require('./events');
const auditEventService = require('./auditEventService');

class ChangeService {
  static async generateNumber(tenantId) {
    const prefix = 'CHG';
    const year = new Date().getFullYear();
    const count = await Change.countDocuments({ company: tenantId });
    return `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  static async create(data, actorId) {
    const number = data.number || await this.generateNumber(data.company);
    const change = await Change.create({ ...data, number, status: data.status || 'new', createdBy: actorId, updatedBy: actorId });
    await auditEventService.record({ tenantId: change.company, actorId, action: 'change.created', resourceType: 'Change', resourceId: change._id, after: change.toObject() });
    events.emit('change.created', { changeId: change._id, tenantId: change.company });
    return change;
  }

  static async getById(changeId, tenantId) {
    const change = await Change.findOne({ _id: changeId, company: tenantId, isActive: true });
    if (!change) throw new ApiError(404, 'Change not found');
    return change;
  }

  static async list(tenantId, filters = {}) {
    const query = { company: tenantId, isActive: true };
    if (filters.status) query.status = filters.status;
    if (filters.type) query.type = filters.type;
    if (filters.risk) query.risk = filters.risk;
    if (filters.assignedTo) query.assignedTo = filters.assignedTo;
    if (filters.search) query.$or = [{ number: { $regex: filters.search, $options: 'i' } }, { title: { $regex: filters.search, $options: 'i' } }];
    if (filters.windowStart && filters.windowEnd) {
      query.windowStart = { $gte: new Date(filters.windowStart) };
      query.windowEnd = { $lte: new Date(filters.windowEnd) };
    }
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 25, 100);
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Change.find(query).sort(filters.sort || { createdAt: -1 }).skip(skip).limit(limit).populate('assignedTo', 'name email').populate('assignmentGroup', 'name'),
      Change.countDocuments(query),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  static async update(changeId, data, tenantId, actorId) {
    const change = await this.getById(changeId, tenantId);
    if (data.status && data.status !== change.status) assertTransition('change', change.status, data.status);
    const before = change.toObject();
    Object.assign(change, data, { updatedBy: actorId });
    await change.save();
    await auditEventService.record({ tenantId, actorId, action: 'change.updated', resourceType: 'Change', resourceId: change._id, before, after: change.toObject() });
    return change;
  }

  static async transition(changeId, targetStatus, tenantId, actorId, notes = '') {
    const change = await this.getById(changeId, tenantId);
    assertTransition('change', change.status, targetStatus);
    const before = change.toObject();
    const previousStatus = change.status;
    change.status = targetStatus;
    change.updatedBy = actorId;
    if (targetStatus === 'scheduled') change.submittedAt = new Date();
    else if (targetStatus === 'implement') change.actualStart = new Date();
    else if (targetStatus === 'review') change.actualEnd = new Date();
    else if (targetStatus === 'closed') change.closedAt = new Date();
    else if (targetStatus === 'canceled') change.canceledAt = new Date();
    change.timeline.push({ at: new Date(), by: actorId ? String(actorId) : 'system', message: `Status changed from ${previousStatus} to ${targetStatus}${notes ? ': ' + notes : ''}` });
    await change.save();
    await auditEventService.record({ tenantId, actorId, action: 'change.transition', resourceType: 'Change', resourceId: change._id, before, after: change.toObject() });
    events.emit('change.updated', { changeId: change._id, tenantId });
    return change;
  }

  static async close(changeId, closeCode, closeNotes, tenantId, actorId) {
    const change = await this.transition(changeId, 'closed', tenantId, actorId);
    change.closeCode = closeCode || 'successful';
    change.closeNotes = closeNotes || '';
    await change.save();
    return change;
  }

  static async rollback(changeId, reason, tenantId, actorId) {
    return this.transition(changeId, 'canceled', tenantId, actorId, reason);
  }

  static async linkCI(changeId, ciId, role, tenantId, actorId) {
    const existing = await ChangeCI.findOne({ change: changeId, ci: ciId });
    if (existing) { existing.role = role || existing.role; existing.isActive = true; await existing.save(); return existing; }
    return ChangeCI.create({ change: changeId, ci: ciId, company: tenantId, role: role || 'affected', linkedBy: actorId });
  }

  static async unlinkCI(changeId, ciId, tenantId) {
    return ChangeCI.findOneAndUpdate({ change: changeId, ci: ciId, company: tenantId }, { isActive: false }, { new: true });
  }

  static async listCIs(changeId, tenantId) {
    return ChangeCI.find({ change: changeId, company: tenantId, isActive: true }).populate('ci');
  }

  static async linkService(changeId, serviceId, impactLevel, tenantId, actorId) {
    const existing = await ChangeService.findOne({ change: changeId, service: serviceId });
    if (existing) { existing.impactLevel = impactLevel || existing.impactLevel; existing.isActive = true; await existing.save(); return existing; }
    return ChangeService.create({ change: changeId, service: serviceId, company: tenantId, impactLevel: impactLevel || 'low', linkedBy: actorId });
  }

  static async assessRisk(changeId, riskData, tenantId, actorId) {
    const existing = await ChangeRiskAssessment.findOne({ change: changeId, company: tenantId });
    if (existing) {
      Object.assign(existing, riskData, { assessedBy: actorId, assessedAt: new Date() });
      await existing.save();
      return existing;
    }
    return ChangeRiskAssessment.create({ ...riskData, change: changeId, company: tenantId, assessedBy: actorId });
  }

  static async detectConflicts(changeId, tenantId) {
    const change = await this.getById(changeId, tenantId);
    if (!change.windowStart || !change.windowEnd) return [];

    const overlapping = await Change.find({
      _id: { $ne: changeId },
      company: tenantId,
      isActive: true,
      status: { $nin: ['closed', 'canceled'] },
      windowStart: { $lt: change.windowEnd },
      windowEnd: { $gt: change.windowStart },
    });

    const blackouts = await BlackoutWindow.find({
      company: tenantId,
      isActive: true,
      startTime: { $lt: change.windowEnd },
      endTime: { $gt: change.windowStart },
    });

    const conflicts = [];
    for (const ov of overlapping) {
      conflicts.push(await ChangeConflict.create({ change: changeId, conflictingChange: ov._id, company: tenantId, conflictType: 'schedule_overlap', description: `Overlaps with ${ov.number}` }));
    }
    for (const bw of blackouts) {
      conflicts.push(await ChangeConflict.create({ change: changeId, conflictingChange: null, company: tenantId, conflictType: 'blackout_violation', description: `Blackout window: ${bw.name}` }));
    }
    return conflicts;
  }

  static async listConflicts(changeId, tenantId) {
    return ChangeConflict.find({ change: changeId, company: tenantId });
  }

  static async createTask(changeId, taskData, tenantId, actorId) {
    const count = await ChangeTask.countDocuments({ change: changeId });
    return ChangeTask.create({ ...taskData, number: `CHGT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`, change: changeId, company: tenantId, createdBy: actorId });
  }

  static async listTasks(changeId, tenantId) {
    return ChangeTask.find({ change: changeId, company: tenantId, isActive: true }).sort({ order: 1 });
  }

  static async createImplementationResult(changeId, data, tenantId, actorId) {
    const existing = await ChangeImplementationResult.findOne({ change: changeId, company: tenantId });
    if (existing) { Object.assign(existing, data, { implementedBy: actorId }); await existing.save(); return existing; }
    return ChangeImplementationResult.create({ ...data, change: changeId, company: tenantId, implementedBy: actorId });
  }

  static async listModels(tenantId) {
    return ChangeModel.find({ company: tenantId, isActive: true });
  }

  static async listTemplates(tenantId) {
    return StandardChangeTemplate.find({ company: tenantId, isActive: true });
  }

  static async listMaintenanceWindows(tenantId) {
    return MaintenanceWindow.find({ company: tenantId, isActive: true }).sort({ startTime: 1 });
  }

  static async listBlackoutWindows(tenantId) {
    return BlackoutWindow.find({ company: tenantId, isActive: true }).sort({ startTime: 1 });
  }

  static async listApprovalPolicies(tenantId) {
    return ChangeApprovalPolicy.find({ company: tenantId, isActive: true });
  }

  static async listCABs(tenantId) {
    return CABDefinition.find({ company: tenantId, isActive: true });
  }

  static async createCABMeeting(cabId, data, tenantId, actorId) {
    return CABMeeting.create({ ...data, cab: cabId, company: tenantId, createdBy: actorId });
  }

  static async listCABMeetings(tenantId, filters = {}) {
    const query = { company: tenantId };
    if (filters.cab) query.cab = filters.cab;
    if (filters.status) query.status = filters.status;
    return CABMeeting.find(query).sort({ scheduledAt: -1 }).populate('cab', 'name');
  }

  static async addAgendaItem(meetingId, data, tenantId) {
    const count = await CABAgendaItem.countDocuments({ meeting: meetingId });
    return CABAgendaItem.create({ ...data, meeting: meetingId, company: tenantId, order: count + 1 });
  }

  static async listAgendaItems(meetingId, tenantId) {
    return CABAgendaItem.find({ meeting: meetingId, company: tenantId }).sort({ order: 1 }).populate('change', 'number title risk status');
  }

  static async decideAgendaItem(itemId, decision, decisionNotes, tenantId, actorId) {
    const item = await CABAgendaItem.findOne({ _id: itemId, company: tenantId });
    if (!item) throw new ApiError(404, 'Agenda item not found');
    item.decision = decision;
    item.decisionNotes = decisionNotes || '';
    item.decidedBy = actorId;
    item.decidedAt = new Date();
    await item.save();
    return item;
  }

  static async addAttendee(meetingId, userId, tenantId) {
    const existing = await CABAttendee.findOne({ meeting: meetingId, user: userId });
    if (existing) return existing;
    return CABAttendee.create({ meeting: meetingId, user: userId, company: tenantId });
  }

  static async listAttendees(meetingId, tenantId) {
    return CABAttendee.find({ meeting: meetingId, company: tenantId }).populate('user', 'name email');
  }

  static async getAssignmentHistory(changeId, tenantId) {
    return [];
  }
}

module.exports = ChangeService;
