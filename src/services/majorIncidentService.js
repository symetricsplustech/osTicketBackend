const MajorIncident = require('../models/helpdesk/incidents/MajorIncident');
const MajorIncidentCandidate = require('../models/helpdesk/incidents/MajorIncidentCandidate');
const MajorIncidentParticipant = require('../models/helpdesk/incidents/MajorIncidentParticipant');
const MajorIncidentTimelineEvent = require('../models/helpdesk/incidents/MajorIncidentTimelineEvent');
const MajorIncidentTeam = require('../models/helpdesk/incidents/MajorIncidentTeam');
const Stakeholder = require('../models/helpdesk/incidents/Stakeholder');
const CommunicationPlan = require('../models/helpdesk/incidents/CommunicationPlan');
const CommunicationTemplate = require('../models/helpdesk/incidents/CommunicationTemplate');
const CommunicationTask = require('../models/helpdesk/incidents/CommunicationTask');
const BridgeSession = require('../models/helpdesk/incidents/BridgeSession');
const Incident = require('../models/helpdesk/incidents/Incident');
const ApiError = require('../utils/ApiError');
const events = require('./events');
const auditEventService = require('./auditEventService');
const { emitEvent } = require('../realtime/socketManager');

class MajorIncidentService {
  // ─── Candidate Management ──────────────────────────────────────────────

  static async nominate(incidentId, data, tenantId, actorId) {
    const incident = await Incident.findOne({ _id: incidentId, company: tenantId, isActive: true });
    if (!incident) throw new ApiError(404, 'Incident not found');

    const existingCandidate = await MajorIncidentCandidate.findOne({ incident: incidentId, company: tenantId });
    if (existingCandidate) throw new ApiError(409, 'Incident already nominated as major incident candidate');

    const candidate = await MajorIncidentCandidate.create({
      incident: incidentId,
      company: tenantId,
      nominatedBy: actorId,
      justification: data.justification || '',
      status: 'pending',
    });

    await auditEventService.record({
      tenantId, actorId, action: 'major_incident.nominated',
      resourceType: 'MajorIncidentCandidate', resourceId: candidate._id,
      after: candidate.toObject(),
    });

    return candidate;
  }

  static async approve(candidateId, tenantId, actorId) {
    const candidate = await MajorIncidentCandidate.findOne({ _id: candidateId, company: tenantId });
    if (!candidate) throw new ApiError(404, 'Candidate not found');
    if (candidate.status !== 'pending') throw new ApiError(400, 'Candidate is not pending');

    candidate.status = 'approved';
    candidate.reviewedBy = actorId;
    candidate.reviewedAt = new Date();
    await candidate.save();

    const majorIncident = await MajorIncident.create({
      incident: candidate.incident,
      company: tenantId,
      status: 'declared',
      declaredBy: actorId,
      declaredAt: new Date(),
      commander: data?.commander || actorId,
    });

    await Incident.findByIdAndUpdate(candidate.incident, { isMajor: true });

    // Create default communication plan
    await CommunicationPlan.create({
      tenantId, majorIncidentId: majorIncident._id,
      internal: { enabled: true, cadenceMinutes: 30, channels: ['slack', 'email'] },
      external: { enabled: true, cadenceMinutes: 60, channels: ['email'] },
      stakeholder: { enabled: true, cadenceMinutes: 60 },
      executive: { enabled: true, cadenceMinutes: 120 },
    });

    await MajorIncidentTimelineEvent.create({
      majorIncident: majorIncident._id,
      incident: candidate.incident,
      company: tenantId,
      eventType: 'status_change',
      message: 'Major incident declared',
      author: actorId,
      visibility: 'internal',
    });

    await auditEventService.record({
      tenantId, actorId, action: 'major_incident.declared',
      resourceType: 'MajorIncident', resourceId: majorIncident._id,
      after: majorIncident.toObject(),
    });

    events.emit('incident.created', { incidentId: candidate.incident, tenantId, isMajor: true });

    return majorIncident;
  }

  static async reject(candidateId, reason, tenantId, actorId) {
    const candidate = await MajorIncidentCandidate.findOne({ _id: candidateId, company: tenantId });
    if (!candidate) throw new ApiError(404, 'Candidate not found');

    candidate.status = 'rejected';
    candidate.reviewedBy = actorId;
    candidate.reviewedAt = new Date();
    candidate.rejectionReason = reason || '';
    await candidate.save();

    await auditEventService.record({
      tenantId, actorId, action: 'major_incident.rejected',
      resourceType: 'MajorIncidentCandidate', resourceId: candidate._id,
      after: candidate.toObject(),
    });

    return candidate;
  }

  static async demote(majorIncidentId, reason, tenantId, actorId) {
    const majorIncident = await MajorIncident.findOne({ _id: majorIncidentId, company: tenantId });
    if (!majorIncident) throw new ApiError(404, 'Major incident not found');
    if (majorIncident.status !== 'declared') throw new ApiError(400, 'Major incident is not declared');

    majorIncident.status = 'demoted';
    majorIncident.demotedBy = actorId;
    majorIncident.demotedAt = new Date();
    majorIncident.demotionReason = reason || '';
    await majorIncident.save();

    await Incident.findByIdAndUpdate(majorIncident.incident, { isMajor: false });

    await MajorIncidentTimelineEvent.create({
      majorIncident: majorIncident._id,
      incident: majorIncident.incident,
      company: tenantId,
      eventType: 'status_change',
      message: `Major incident demoted: ${reason || 'No reason provided'}`,
      author: actorId,
      visibility: 'internal',
    });

    await auditEventService.record({
      tenantId, actorId, action: 'major_incident.demoted',
      resourceType: 'MajorIncident', resourceId: majorIncident._id,
      after: majorIncident.toObject(),
    });

    return majorIncident;
  }

  // ─── Core CRUD ────────────────────────────────────────────────────────

  static async getById(majorIncidentId, tenantId) {
    const mi = await MajorIncident.findOne({ _id: majorIncidentId, company: tenantId })
      .populate('incident')
      .populate('commander', 'name email')
      .populate('declaredBy', 'name email');
    if (!mi) throw new ApiError(404, 'Major incident not found');
    return mi;
  }

  static async getByIncident(incidentId, tenantId) {
    return MajorIncident.findOne({ incident: incidentId, company: tenantId });
  }

  static async list(tenantId, filters = {}) {
    const query = { company: tenantId };
    if (filters.status) query.status = filters.status;

    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 25, 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      MajorIncident.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit)
        .populate('incident', 'number title severity status')
        .populate('commander', 'name email'),
      MajorIncident.countDocuments(query),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  static async listCandidates(tenantId, filters = {}) {
    const query = { company: tenantId };
    if (filters.status) query.status = filters.status;

    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 25, 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      MajorIncidentCandidate.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit)
        .populate('incident', 'number title severity status')
        .populate('nominatedBy', 'name email'),
      MajorIncidentCandidate.countDocuments(query),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // ─── Team Management ──────────────────────────────────────────────────

  static async addTeamMember(majorIncidentId, data, tenantId, actorId) {
    const mi = await this.getById(majorIncidentId, tenantId);
    const existing = await MajorIncidentTeam.findOne({
      majorIncidentId, userId: data.userId, isActive: true,
    });

    if (existing) {
      Object.assign(existing, pick(data, ['role', 'assignedAreas', 'notes']));
      await existing.save();
      return existing;
    }

    return MajorIncidentTeam.create({
      tenantId, majorIncidentId,
      userId: data.userId,
      role: data.role,
      assignedAreas: data.assignedAreas || [],
      notes: data.notes || '',
    });
  }

  static async removeTeamMember(majorIncidentId, userId, tenantId) {
    return MajorIncidentTeam.findOneAndUpdate(
      { majorIncidentId, userId, isActive: true },
      { isActive: false, leftAt: new Date() },
      { new: true }
    );
  }

  static async listTeam(majorIncidentId, tenantId) {
    return MajorIncidentTeam.find({ majorIncidentId, isActive: true })
      .populate('userId', 'name email role');
  }

  // ─── Stakeholder Management ──────────────────────────────────────────

  static async addStakeholder(majorIncidentId, data, tenantId) {
    return Stakeholder.create({ tenantId, majorIncidentId, ...data });
  }

  static async updateStakeholder(stakeholderId, data, tenantId) {
    return Stakeholder.findOneAndUpdate(
      { _id: stakeholderId, tenantId },
      { $set: data },
      { new: true }
    );
  }

  static async removeStakeholder(stakeholderId, tenantId) {
    return Stakeholder.findOneAndDelete({ _id: stakeholderId, tenantId });
  }

  static async listStakeholders(majorIncidentId, tenantId) {
    return Stakeholder.find({ majorIncidentId, tenantId, isActive: true })
      .populate('userId', 'name email');
  }

  // ─── Communication Plan ──────────────────────────────────────────────

  static async getCommunicationPlan(majorIncidentId, tenantId) {
    let plan = await CommunicationPlan.findOne({ majorIncidentId, tenantId });
    if (!plan) {
      plan = await CommunicationPlan.create({
        tenantId, majorIncidentId,
        internal: { enabled: true, cadenceMinutes: 30, channels: ['slack', 'email'] },
        external: { enabled: true, cadenceMinutes: 60, channels: ['email'] },
        stakeholder: { enabled: true, cadenceMinutes: 60 },
        executive: { enabled: true, cadenceMinutes: 120 },
      });
    }
    return plan;
  }

  static async updateCommunicationPlan(majorIncidentId, planData, tenantId, actorId) {
    const plan = await this.getCommunicationPlan(majorIncidentId, tenantId);
    Object.assign(plan, pick(planData, ['internal', 'external', 'stakeholder', 'executive', 'autoBroadcast', 'messageTemplate']));
    await plan.save();

    await MajorIncidentTimelineEvent.create({
      majorIncident: majorIncidentId, incident: plan.majorIncidentId,
      company: tenantId, eventType: 'communication',
      message: 'Communication plan updated', author: actorId, visibility: 'internal',
    });

    return plan;
  }

  // ─── Communication Templates ─────────────────────────────────────────

  static async listTemplates(tenantId, type) {
    const query = { tenantId, isActive: true };
    if (type) query.type = type;
    return CommunicationTemplate.find(query).sort({ name: 1 });
  }

  static async createTemplate(tenantId, data, actorId) {
    return CommunicationTemplate.create({ ...data, tenantId, createdBy: actorId });
  }

  static async updateTemplate(templateId, data, tenantId) {
    return CommunicationTemplate.findOneAndUpdate(
      { _id: templateId, tenantId }, { $set: data }, { new: true }
    );
  }

  static async deleteTemplate(templateId, tenantId) {
    return CommunicationTemplate.findOneAndDelete({ _id: templateId, tenantId });
  }

  // ─── Communication Tasks ─────────────────────────────────────────────

  static async createCommunicationTask(majorIncidentId, data, tenantId, actorId) {
    const task = await CommunicationTask.create({
      ...data, tenantId, majorIncidentId, createdBy: actorId,
    });
    return task;
  }

  static async executeCommunicationTask(taskId, tenantId) {
    const task = await CommunicationTask.findOne({ _id: taskId, tenantId });
    if (!task) throw new ApiError(404, 'Communication task not found');
    if (task.status !== 'pending' && task.status !== 'scheduled') throw new ApiError(400, 'Task already processed');

    task.status = 'sending';
    await task.save();

    try {
      // In production, integrate with actual notification service
      // await notificationService.send({ ... });
      task.status = 'sent';
      task.sentAt = new Date();
      task.deliveredCount = task.recipientCount || 0;
    } catch (error) {
      task.status = 'failed';
      task.errorMessage = error.message;
      task.failedAt = new Date();
      if (task.retryCount < task.maxRetries) {
        task.retryCount++;
        task.status = 'scheduled';
      }
    }
    await task.save();
    return task;
  }

  static async listCommunicationTasks(majorIncidentId, tenantId, filters = {}) {
    const query = { majorIncidentId, tenantId };
    if (filters.status) query.status = filters.status;
    return CommunicationTask.find(query).sort({ scheduledAt: 1 });
  }

  // ─── Bridge Sessions ─────────────────────────────────────────────────

  static async createBridgeSession(majorIncidentId, data, tenantId, actorId) {
    const session = await BridgeSession.create({
      ...data, tenantId, majorIncidentId, hostId: actorId,
    });
    await MajorIncidentTimelineEvent.create({
      majorIncident: majorIncidentId,
      incident: data.incident,
      company: tenantId, eventType: 'note',
      message: `Bridge session created: ${data.provider}`, author: actorId, visibility: 'internal',
    });
    return session;
  }

  static async startBridgeSession(sessionId, tenantId) {
    const session = await BridgeSession.findOneAndUpdate(
      { _id: sessionId, tenantId, status: 'scheduled' },
      { status: 'active', startedAt: new Date() },
      { new: true }
    );
    return session;
  }

  static async endBridgeSession(sessionId, tenantId) {
    const session = await BridgeSession.findOneAndUpdate(
      { _id: sessionId, tenantId, status: 'active' },
      { status: 'ended', endedAt: new Date(), duration: Date.now() - new Date(session.startedAt).getTime() },
      { new: true }
    );
    return session;
  }

  static async getBridgeSession(majorIncidentId, tenantId) {
    return BridgeSession.findOne({ majorIncidentId, tenantId }).sort({ createdAt: -1 });
  }

  // ─── Timeline Events ─────────────────────────────────────────────────

  static async addTimelineEvent(majorIncidentId, eventData, tenantId, actorId) {
    return MajorIncidentTimelineEvent.create({
      majorIncident: majorIncidentId,
      incident: eventData.incident,
      company: tenantId,
      eventType: eventData.eventType,
      message: eventData.message,
      author: actorId,
      visibility: eventData.visibility || 'internal',
    });
  }

  static async listTimelineEvents(majorIncidentId, tenantId, filters = {}) {
    const query = { majorIncident: majorIncidentId, company: tenantId };
    if (filters.visibility) query.visibility = filters.visibility;
    return MajorIncidentTimelineEvent.find(query).sort({ createdAt: -1 }).populate('author', 'name email');
  }

  // ─── Exec Summary ────────────────────────────────────────────────────

  static async updateExecSummary(majorIncidentId, execSummary, tenantId, actorId) {
    const mi = await this.getById(majorIncidentId, tenantId);
    mi.execSummary = execSummary;
    await mi.save();

    await MajorIncidentTimelineEvent.create({
      majorIncident: mi._id, incident: mi.incident, company: tenantId,
      eventType: 'note', message: 'Executive summary updated', author: actorId, visibility: 'stakeholder',
    });

    return mi;
  }

  // ─── Cadence/Broadcast Job ──────────────────────────────────────────

  static async processCommunicationCadence(tenantId) {
    const now = new Date();
    const plans = await CommunicationPlan.find({
      tenantId, autoBroadcast: true,
      $or: [
        { 'internal.enabled': true, nextInternalAt: { $lte: now } },
        { 'external.enabled': true, nextExternalAt: { $lte: now } },
        { 'stakeholder.enabled': true, nextStakeholderAt: { $lte: now } },
        { 'executive.enabled': true, nextExecutiveAt: { $lte: now } },
      ],
    });

    for (const plan of plans) {
      if (plan.internal.enabled && plan.nextInternalAt <= now) {
        await this.broadcastInternal(plan.majorIncidentId, tenantId);
        plan.lastInternalAt = now;
        plan.nextInternalAt = new Date(now.getTime() + plan.internal.cadenceMinutes * 60000);
      }
      if (plan.external.enabled && plan.nextExternalAt <= now) {
        await this.broadcastExternal(plan.majorIncidentId, tenantId);
        plan.lastExternalAt = now;
        plan.nextExternalAt = new Date(now.getTime() + plan.external.cadenceMinutes * 60000);
      }
      if (plan.stakeholder.enabled && plan.nextStakeholderAt <= now) {
        await this.broadcastStakeholder(plan.majorIncidentId, tenantId);
        plan.lastStakeholderAt = now;
        plan.nextStakeholderAt = new Date(now.getTime() + plan.stakeholder.cadenceMinutes * 60000);
      }
      if (plan.executive.enabled && plan.nextExecutiveAt <= now) {
        await this.broadcastExecutive(plan.majorIncidentId, tenantId);
        plan.lastExecutiveAt = now;
        plan.nextExecutiveAt = new Date(now.getTime() + plan.executive.cadenceMinutes * 60000);
      }
      await plan.save();
    }
  }

  static async broadcastInternal(majorIncidentId, tenantId) {
    const mi = await MajorIncident.findOne({ _id: majorIncidentId, company: tenantId, status: 'declared' });
    if (!mi) return;

    const team = await MajorIncidentTeam.find({ majorIncidentId, isActive: true })
      .populate('userId', 'name email');

    const message = mi.communicationPlan?.messageTemplate || `Internal update: ${mi.execSummary || 'Status unchanged'}`;

    const task = await CommunicationTask.create({
      tenantId, majorIncidentId,
      type: 'internal', audience: 'internal', channel: 'slack',
      subject: `Major Incident Update: ${mi.incident?.number || mi._id}`,
      body: message, status: 'pending',
      recipientCount: team.length,
      variables: { incidentNumber: mi.incident?.number, execSummary: mi.execSummary },
    });

    await this.executeCommunicationTask(task._id, tenantId);
    emitEvent(tenantId, 'major_incident.broadcast', { majorIncidentId, audience: 'internal', message });
  }

  static async broadcastExternal(majorIncidentId, tenantId) {
    // Similar to internal but for customers/partners
    // Implementation depends on customer notification system
    emitEvent(tenantId, 'major_incident.broadcast', { majorIncidentId, audience: 'external' });
  }

  static async broadcastStakeholder(majorIncidentId, tenantId) {
    const stakeholders = await Stakeholder.find({ majorIncidentId, tenantId, isActive: true });
    if (!stakeholders.length) return;

    const mi = await MajorIncident.findOne({ _id: majorIncidentId, company: tenantId, status: 'declared' });
    if (!mi) return;

    const message = mi.communicationPlan?.messageTemplate || `Stakeholder update: ${mi.execSummary || 'Status unchanged'}`;

    const task = await CommunicationTask.create({
      tenantId, majorIncidentId,
      type: 'stakeholder', audience: 'stakeholder', channel: 'email',
      subject: `Stakeholder Update: Major Incident ${mi.incident?.number || mi._id}`,
      body: message, status: 'pending',
      recipientCount: stakeholders.length,
      variables: { incidentNumber: mi.incident?.number, execSummary: mi.execSummary },
    });

    await this.executeCommunicationTask(task._id, tenantId);
    emitEvent(tenantId, 'major_incident.broadcast', { majorIncidentId, audience: 'stakeholder', message });
  }

  static async broadcastExecutive(majorIncidentId, tenantId) {
    // Send executive summary to exec stakeholders
    emitEvent(tenantId, 'major_incident.broadcast', { majorIncidentId, audience: 'executive' });
  }

  // ─── Dashboard ───────────────────────────────────────────────────────

  static async getDashboard(tenantId) {
    const [majorIncidents, candidates, plans, templates, bridgeSessions] = await Promise.all([
      MajorIncident.find({ company: tenantId, status: 'declared' }),
      MajorIncidentCandidate.find({ company: tenantId, status: 'pending' }),
      CommunicationPlan.find({ tenantId }),
      CommunicationTemplate.find({ tenantId, isActive: true }),
      BridgeSession.find({ tenantId, status: { $in: ['scheduled', 'active'] } }),
    ]);

    const byStatus = {};
    for (const mi of majorIncidents) { byStatus[mi.status] = (byStatus[mi.status] || 0) + 1; }

    return {
      activeMajorIncidents: majorIncidents.length,
      pendingCandidates: candidates.length,
      communicationPlans: plans.length,
      templates: templates.length,
      activeBridgeSessions: bridgeSessions.length,
      byStatus,
      severityBreakdown: majorIncidents.reduce((acc, m) => { acc[m.majorType || 'other'] = (acc[m.majorType || 'other'] || 0) + 1; return acc; }, {}),
    };
  }
}

function pick(obj, keys) {
  return Object.fromEntries(keys.filter(k => obj[k] !== undefined).map(k => [k, obj[k]]));
}

module.exports = MajorIncidentService;
