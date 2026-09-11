const MajorIncident = require('../models/helpdesk/incidents/MajorIncident');
const MajorIncidentCandidate = require('../models/helpdesk/incidents/MajorIncidentCandidate');
const MajorIncidentParticipant = require('../models/helpdesk/incidents/MajorIncidentParticipant');
const MajorIncidentTimelineEvent = require('../models/helpdesk/incidents/MajorIncidentTimelineEvent');
const Incident = require('../models/helpdesk/incidents/Incident');
const ApiError = require('../utils/ApiError');
const events = require('./events');
const auditEventService = require('./auditEventService');

class MajorIncidentService {
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
      tenantId,
      actorId,
      action: 'major_incident.nominated',
      resourceType: 'MajorIncidentCandidate',
      resourceId: candidate._id,
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
      commander: data.commander || actorId,
    });

    await Incident.findByIdAndUpdate(candidate.incident, { isMajor: true });

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
      tenantId,
      actorId,
      action: 'major_incident.declared',
      resourceType: 'MajorIncident',
      resourceId: majorIncident._id,
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
      tenantId,
      actorId,
      action: 'major_incident.rejected',
      resourceType: 'MajorIncidentCandidate',
      resourceId: candidate._id,
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
      tenantId,
      actorId,
      action: 'major_incident.demoted',
      resourceType: 'MajorIncident',
      resourceId: majorIncident._id,
      after: majorIncident.toObject(),
    });

    return majorIncident;
  }

  static async getById(majorIncidentId, tenantId) {
    const mi = await MajorIncident.findOne({ _id: majorIncidentId, company: tenantId })
      .populate('incident')
      .populate('commander', 'name email')
      .populate('declaredBy', 'name email');
    if (!mi) throw new ApiError(400, 'Major incident not found');
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

  static async addParticipant(majorIncidentId, participantData, tenantId, actorId) {
    const existing = await MajorIncidentParticipant.findOne({
      majorIncident: majorIncidentId,
      user: participantData.user,
    });

    if (existing) {
      existing.role = participantData.role;
      existing.isActive = true;
      existing.leftAt = null;
      await existing.save();
      return existing;
    }

    return MajorIncidentParticipant.create({
      majorIncident: majorIncidentId,
      incident: participantData.incident,
      company: tenantId,
      user: participantData.user,
      role: participantData.role,
    });
  }

  static async removeParticipant(majorIncidentId, userId, tenantId) {
    return MajorIncidentParticipant.findOneAndUpdate(
      { majorIncident: majorIncidentId, user: userId, company: tenantId },
      { isActive: false, leftAt: new Date() },
      { new: true }
    );
  }

  static async listParticipants(majorIncidentId, tenantId) {
    return MajorIncidentParticipant.find({
      majorIncident: majorIncidentId,
      company: tenantId,
      isActive: true,
    }).populate('user', 'name email');
  }

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

  static async updateCommunicationPlan(majorIncidentId, planData, tenantId, actorId) {
    const mi = await this.getById(majorIncidentId, tenantId);
    mi.communicationPlan = { ...mi.communicationPlan, ...planData };
    await mi.save();

    await MajorIncidentTimelineEvent.create({
      majorIncident: mi._id,
      incident: mi.incident,
      company: tenantId,
      eventType: 'communication',
      message: 'Communication plan updated',
      author: actorId,
      visibility: 'internal',
    });

    return mi;
  }

  static async updateExecSummary(majorIncidentId, execSummary, tenantId, actorId) {
    const mi = await this.getById(majorIncidentId, tenantId);
    mi.execSummary = execSummary;
    await mi.save();

    await MajorIncidentTimelineEvent.create({
      majorIncident: mi._id,
      incident: mi.incident,
      company: tenantId,
      eventType: 'note',
      message: 'Executive summary updated',
      author: actorId,
      visibility: 'stakeholder',
    });

    return mi;
  }
}

module.exports = MajorIncidentService;
