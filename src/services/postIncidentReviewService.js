const PostIncidentReview = require('../models/helpdesk/incidents/PostIncidentReview');
const MajorIncident = require('../models/helpdesk/incidents/MajorIncident');
const ApiError = require('../utils/ApiError');
const auditEventService = require('./auditEventService');

class PostIncidentReviewService {
  static async create(data, tenantId, actorId) {
    const pir = await PostIncidentReview.create({
      ...data,
      company: tenantId,
      createdBy: actorId,
    });

    await auditEventService.record({
      tenantId,
      actorId,
      action: 'pir.created',
      resourceType: 'PostIncidentReview',
      resourceId: pir._id,
      after: pir.toObject(),
    });

    return pir;
  }

  static async getById(pirId, tenantId) {
    const pir = await PostIncidentReview.findOne({ _id: pirId, company: tenantId })
      .populate('incident', 'number title severity status')
      .populate('majorIncident', 'status')
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email');
    if (!pir) throw new ApiError(404, 'Post-incident review not found');
    return pir;
  }

  static async getByIncident(incidentId, tenantId) {
    return PostIncidentReview.findOne({ incident: incidentId, company: tenantId });
  }

  static async list(tenantId, filters = {}) {
    const query = { company: tenantId };
    if (filters.status) query.status = filters.status;
    if (filters.incident) query.incident = filters.incident;

    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 25, 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      PostIncidentReview.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit)
        .populate('incident', 'number title severity')
        .populate('createdBy', 'name email'),
      PostIncidentReview.countDocuments(query),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  static async update(pirId, data, tenantId, actorId) {
    const pir = await this.getById(pirId, tenantId);
    const before = pir.toObject();
    Object.assign(pir, data);
    await pir.save();

    await auditEventService.record({
      tenantId,
      actorId,
      action: 'pir.updated',
      resourceType: 'PostIncidentReview',
      resourceId: pir._id,
      before,
      after: pir.toObject(),
    });

    return pir;
  }

  static async submitForReview(pirId, tenantId, actorId) {
    const pir = await this.getById(pirId, tenantId);
    if (pir.status !== 'draft') throw new ApiError(400, 'Only draft PIRs can be submitted for review');
    pir.status = 'in_review';
    await pir.save();
    return pir;
  }

  static async approve(pirId, tenantId, actorId) {
    const pir = await this.getById(pirId, tenantId);
    if (pir.status !== 'in_review') throw new ApiError(400, 'Only PIRs in review can be approved');
    pir.status = 'approved';
    pir.approvedBy = actorId;
    pir.approvedAt = new Date();
    await pir.save();

    await auditEventService.record({
      tenantId,
      actorId,
      action: 'pir.approved',
      resourceType: 'PostIncidentReview',
      resourceId: pir._id,
      after: pir.toObject(),
    });

    return pir;
  }

  static async publish(pirId, tenantId, actorId) {
    const pir = await this.getById(pirId, tenantId);
    if (pir.status !== 'approved') throw new ApiError(400, 'Only approved PIRs can be published');
    pir.status = 'published';
    pir.publishedAt = new Date();
    await pir.save();

    await auditEventService.record({
      tenantId,
      actorId,
      action: 'pir.published',
      resourceType: 'PostIncidentReview',
      resourceId: pir._id,
      after: pir.toObject(),
    });

    return pir;
  }

  static async addActionItem(pirId, actionItem, tenantId, actorId) {
    const pir = await this.getById(pirId, tenantId);
    pir.actionItems.push(actionItem);
    await pir.save();
    return pir;
  }

  static async updateActionItem(pirId, actionItemId, updates, tenantId) {
    const pir = await this.getById(pirId, tenantId);
    const item = pir.actionItems.id(actionItemId);
    if (!item) throw new ApiError(404, 'Action item not found');
    Object.assign(item, updates);
    if (updates.status === 'completed') item.completedAt = new Date();
    await pir.save();
    return pir;
  }

  static async deleteActionItem(pirId, actionItemId, tenantId) {
    const pir = await this.getById(pirId, tenantId);
    pir.actionItems.pull(actionItemId);
    await pir.save();
    return pir;
  }
}

module.exports = PostIncidentReviewService;
