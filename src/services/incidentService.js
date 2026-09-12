const mongoose = require("mongoose");
const Incident = require("../models/helpdesk/incidents/Incident");
const IncidentTask = require("../models/helpdesk/incidents/IncidentTask");
const IncidentCI = require("../models/helpdesk/incidents/IncidentCI");
const IncidentServiceOffering = require("../models/helpdesk/incidents/IncidentServiceOffering");
const IncidentRelationship = require("../models/helpdesk/incidents/IncidentRelationship");
const IncidentAssignmentHistory = require("../models/helpdesk/incidents/IncidentAssignmentHistory");
const IncidentResolution = require("../models/helpdesk/incidents/IncidentResolution");
const ApiError = require("../utils/ApiError");
const {
  assertTransition,
  INCIDENT_TRANSITIONS,
} = require("./stateMachine.service");
const events = require("./events");
const auditEventService = require("./auditEventService");

class IncidentService {
  static async generateNumber(tenantId) {
    const prefix = "INC";
    const year = new Date().getFullYear();
    const count = await Incident.countDocuments({ company: tenantId });
    const seq = String(count + 1).padStart(4, "0");
    return `${prefix}-${year}-${seq}`;
  }

  static async create(data, actorId) {
    const number = data.number || (await this.generateNumber(data.company));
    const priority =
      data.priority ||
      Incident.calculatePriority(data.impact || "3", data.urgency || "3");

    const incident = await Incident.create({
      ...data,
      number,
      priority,
      status: data.status || "new",
      createdBy: actorId,
      updatedBy: actorId,
    });

    await IncidentAssignmentHistory.create({
      incident: incident._id,
      company: incident.company,
      assignmentType: "initial",
      toGroup: data.assignmentGroup,
      toAgent: data.assignedTo,
      assignedBy: actorId,
    });

    await auditEventService.record({
      tenantId: incident.company,
      actorId,
      action: "incident.created",
      resourceType: "Incident",
      resourceId: incident._id,
      after: incident.toObject(),
    });

    events.emit("incident.created", {
      incidentId: incident._id,
      tenantId: incident.company,
    });

    return incident;
  }

  static async getById(incidentId, tenantId) {
    const incident = await Incident.findOne({
      _id: incidentId,
      company: tenantId,
      isActive: true,
    });
    if (!incident) throw new ApiError(404, "Incident not found");
    return incident;
  }

  static async list(tenantId, filters = {}) {
    const query = { company: tenantId, isActive: true };
    if (filters.status) query.status = filters.status;
    if (filters.priority) query.priority = filters.priority;
    if (filters.severity) query.severity = filters.severity;
    if (filters.assignedTo) query.assignedTo = filters.assignedTo;
    if (filters.assignmentGroup)
      query.assignmentGroup = filters.assignmentGroup;
    if (filters.isMajor !== undefined) query.isMajor = filters.isMajor;
    if (filters.category) query.category = filters.category;
    if (filters.search) {
      query.$or = [
        { number: { $regex: filters.search, $options: "i" } },
        { title: { $regex: filters.search, $options: "i" } },
      ];
    }

    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 25, 100);
    const skip = (page - 1) * limit;
    const sort = filters.sort || { createdAt: -1 };

    const [items, total] = await Promise.all([
      Incident.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("assignedTo", "name email")
        .populate("assignmentGroup", "name"),
      Incident.countDocuments(query),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  static async update(incidentId, data, tenantId, actorId) {
    const incident = await this.getById(incidentId, tenantId);

    if (data.status && data.status !== incident.status) {
      assertTransition("incident", incident.status, data.status);
    }

    const before = incident.toObject();
    Object.assign(incident, data, { updatedBy: actorId });

    if (
      data.assignedTo &&
      String(data.assignedTo) !== String(incident.assignedTo)
    ) {
      await IncidentAssignmentHistory.create({
        incident: incident._id,
        company: tenantId,
        assignmentType: "reassignment",
        fromAgent: before.assignedTo,
        toAgent: data.assignedTo,
        assignedBy: actorId,
      });
    }

    if (
      data.assignmentGroup &&
      String(data.assignmentGroup) !== String(incident.assignmentGroup)
    ) {
      await IncidentAssignmentHistory.create({
        incident: incident._id,
        company: tenantId,
        assignmentType: "reassignment",
        fromGroup: before.assignmentGroup,
        toGroup: data.assignmentGroup,
        assignedBy: actorId,
      });
    }

    await incident.save();

    await auditEventService.record({
      tenantId,
      actorId,
      action: "incident.updated",
      resourceType: "Incident",
      resourceId: incident._id,
      before,
      after: incident.toObject(),
    });

    events.emit("incident.updated", { incidentId: incident._id, tenantId });

    return incident;
  }

  static async transition(
    incidentId,
    targetStatus,
    tenantId,
    actorId,
    notes = "",
  ) {
    const incident = await this.getById(incidentId, tenantId);
    assertTransition("incident", incident.status, targetStatus);

    const before = incident.toObject();
    const previousStatus = incident.status;
    incident.status = targetStatus;
    incident.updatedBy = actorId;

    if (targetStatus === "resolved") {
      incident.resolvedAt = new Date();
      incident.resolution = notes || incident.resolution;
    } else if (targetStatus === "closed") {
      incident.closedAt = new Date();
    } else if (targetStatus === "canceled") {
      incident.canceledAt = new Date();
    } else if (targetStatus.startsWith("on_hold_")) {
      incident.holdReason = targetStatus.replace("on_hold_", "");
    } else if (targetStatus === "in_progress") {
      incident.holdReason = "";
    }

    incident.timeline.push({
      at: new Date(),
      by: actorId ? String(actorId) : "system",
      message: `Status changed from ${previousStatus} to ${targetStatus}${notes ? ": " + notes : ""}`,
    });

    await incident.save();

    await auditEventService.record({
      tenantId,
      actorId,
      action: "incident.transition",
      resourceType: "Incident",
      resourceId: incident._id,
      before,
      after: incident.toObject(),
    });

    events.emit("status.incident", {
      incidentId: incident._id,
      tenantId,
      from: previousStatus,
      to: targetStatus,
    });

    return incident;
  }

  static async assign(incidentId, assignment, tenantId, actorId) {
    const incident = await this.getById(incidentId, tenantId);
    const before = incident.toObject();

    if (assignment.assignedTo) incident.assignedTo = assignment.assignedTo;
    if (assignment.assignmentGroup)
      incident.assignmentGroup = assignment.assignmentGroup;
    if (assignment.commander) incident.commander = assignment.commander;
    incident.updatedBy = actorId;

    await incident.save();

    await IncidentAssignmentHistory.create({
      incident: incident._id,
      company: tenantId,
      assignmentType: assignment.type || "reassignment",
      fromAgent: before.assignedTo,
      fromGroup: before.assignmentGroup,
      toAgent: assignment.assignedTo || incident.assignedTo,
      toGroup: assignment.assignmentGroup || incident.assignmentGroup,
      reason: assignment.reason || "",
      assignedBy: actorId,
    });

    await auditEventService.record({
      tenantId,
      actorId,
      action: "incident.assigned",
      resourceType: "Incident",
      resourceId: incident._id,
      before,
      after: incident.toObject(),
    });

    return incident;
  }

  static async addComment(incidentId, comment, tenantId, actorId) {
    const incident = await this.getById(incidentId, tenantId);
    incident.timeline.push({
      at: new Date(),
      by: actorId ? String(actorId) : "system",
      message: comment.message,
    });
    incident.updates.push({
      at: new Date(),
      status: comment.type || "comment",
      message: comment.message,
    });
    incident.updatedBy = actorId;
    await incident.save();

    events.emit("incident.updated", { incidentId: incident._id, tenantId });

    return incident;
  }

  static async linkCI(incidentId, ciId, role, tenantId, actorId) {
    const existing = await IncidentCI.findOne({
      incident: incidentId,
      ci: ciId,
    });
    if (existing) {
      existing.role = role || existing.role;
      existing.isActive = true;
      await existing.save();
      return existing;
    }

    return IncidentCI.create({
      incident: incidentId,
      ci: ciId,
      company: tenantId,
      role: role || "affected",
      linkedBy: actorId,
    });
  }

  static async unlinkCI(incidentId, ciId, tenantId) {
    return IncidentCI.findOneAndUpdate(
      { incident: incidentId, ci: ciId, company: tenantId },
      { isActive: false },
      { new: true },
    );
  }

  static async listCIs(incidentId, tenantId) {
    return IncidentCI.find({
      incident: incidentId,
      company: tenantId,
      isActive: true,
    }).populate("ci");
  }

  static async linkServiceOffering(
    incidentId,
    serviceOfferingId,
    role,
    tenantId,
    actorId,
  ) {
    const existing = await IncidentServiceOffering.findOne({
      incident: incidentId,
      serviceOffering: serviceOfferingId,
    });
    if (existing) {
      existing.role = role || existing.role;
      existing.isActive = true;
      await existing.save();
      return existing;
    }

    return IncidentServiceOffering.create({
      incident: incidentId,
      serviceOffering: serviceOfferingId,
      company: tenantId,
      role: role || "affected",
      linkedBy: actorId,
    });
  }

  static async linkIncident(
    sourceId,
    targetId,
    relationshipType,
    tenantId,
    actorId,
  ) {
    const existing = await IncidentRelationship.findOne({
      sourceIncident: sourceId,
      targetIncident: targetId,
    });
    if (existing) {
      existing.relationshipType = relationshipType || existing.relationshipType;
      existing.isActive = true;
      await existing.save();
      return existing;
    }

    return IncidentRelationship.create({
      sourceIncident: sourceId,
      targetIncident: targetId,
      company: tenantId,
      relationshipType: relationshipType || "relates_to",
      linkedBy: actorId,
    });
  }

  static async listRelationships(incidentId, tenantId) {
    return IncidentRelationship.find({
      $or: [{ sourceIncident: incidentId }, { targetIncident: incidentId }],
      company: tenantId,
      isActive: true,
    });
  }

  static async resolve(incidentId, resolutionData, tenantId, actorId) {
    const incident = await this.transition(
      incidentId,
      "resolved",
      tenantId,
      actorId,
      resolutionData.notes,
    );

    await IncidentResolution.create({
      incident: incidentId,
      company: tenantId,
      resolutionCode: resolutionData.resolutionCode,
      notes: resolutionData.notes || "",
      rootCause: resolutionData.rootCause || "",
      rootCauseCategory: resolutionData.rootCauseCategory || "unknown",
      workaround: resolutionData.workaround || "",
      resolvedBy: actorId,
      resolvedAt: new Date(),
    });

    return incident;
  }

  static async close(incidentId, tenantId, actorId) {
    return this.transition(incidentId, "closed", tenantId, actorId);
  }

  static async reopen(incidentId, tenantId, actorId, reason = "") {
    const incident = await this.getById(incidentId, tenantId);
    let targetStatus = "new";

    if (
      ["investigating", "identified", "monitoring"].includes(incident.status)
    ) {
      targetStatus = "in_progress";
    }

    return this.transition(
      incidentId,
      targetStatus,
      tenantId,
      actorId,
      reason || "Reopened",
    );
  }

  static async cancel(incidentId, tenantId, actorId, reason = "") {
    return this.transition(incidentId, "canceled", tenantId, actorId, reason);
  }

  static async createTask(incidentId, taskData, tenantId, actorId) {
    const incident = await this.getById(incidentId, tenantId);
    const count = await IncidentTask.countDocuments({ incident: incidentId });
    const number = `INCT-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const task = await IncidentTask.create({
      ...taskData,
      number,
      incident: incidentId,
      company: tenantId,
      createdBy: actorId,
    });

    return task;
  }

  static async listTasks(incidentId, tenantId, filters = {}) {
    const query = { incident: incidentId, company: tenantId, isActive: true };
    if (filters.status) query.status = filters.status;
    return IncidentTask.find(query).sort({ createdAt: -1 });
  }

  static async getAssignmentHistory(incidentId, tenantId) {
    return IncidentAssignmentHistory.find({
      incident: incidentId,
      company: tenantId,
    }).sort({ assignedAt: -1 });
  }

  static async calculatePriority(impact, urgency) {
    return Incident.calculatePriority(impact, urgency);
  }

  static async getDuplicateCandidates(tenantId, title, category) {
    const regex = new RegExp(title.split(/\s+/).join("|"), "i");
    return Incident.find({
      company: tenantId,
      isActive: true,
      status: { $nin: ["closed", "canceled"] },
      $or: [
        { title: { $regex: regex } },
        { category, subcategory: { $exists: true, $ne: "" } },
      ],
    }).limit(5);
  }
}

module.exports = IncidentService;
