const Problem = require("../models/helpdesk/incidents/Problem");
const ProblemTask = require("../models/helpdesk/incidents/ProblemTask");
const ProblemIncident = require("../models/helpdesk/incidents/ProblemIncident");
const Incident = require("../models/helpdesk/incidents/Incident");
const IncidentResolution = require("../models/helpdesk/incidents/IncidentResolution");
const ProblemCI = require("../models/helpdesk/incidents/ProblemCI");
const ProblemServiceOffering = require("../models/helpdesk/incidents/ProblemServiceOffering");
const ProblemChange = require("../models/helpdesk/incidents/ProblemChange");
const ProblemKnowledge = require("../models/helpdesk/incidents/ProblemKnowledge");
const KnownError = require("../models/helpdesk/incidents/KnownError");
const ProblemAssignmentHistory = require("../models/helpdesk/incidents/ProblemAssignmentHistory");
const RootCauseRecord = require("../models/helpdesk/incidents/RootCauseRecord");
const ConfigurationItem = require("../models/cmdb/ConfigurationItem");
const ServiceOffering = require("../models/cmdb/ServiceOffering");
const Change = require("../models/helpdesk/incidents/Change");
const Faq = require("../models/helpdesk/knowledge/Faq");
const ApiError = require("../utils/ApiError");
const { assertTransition } = require("./stateMachine.service");
const { assertTenantOf } = require("./tenantGuard");
const { getTenantId } = require("../middleware/tenantScope");
const { nextNumber } = require("./numbering.service");
const events = require("./events");
const auditEventService = require("./auditEventService");

class ProblemService {
  static async generateNumber(tenantId) {
    return nextNumber(tenantId, "PRB");
  }

  static async create(data, actorId) {
    data = { ...data, company: getTenantId() || data.company };
    const number = data.number || (await this.generateNumber(data.company));

    const problem = await Problem.create({
      ...data,
      number,
      status: data.status || "new",
      createdBy: actorId,
      updatedBy: actorId,
    });

    await ProblemAssignmentHistory.create({
      problem: problem._id,
      company: problem.company,
      assignmentType: "initial",
      toGroup: data.assignmentGroup,
      toAgent: data.assignedTo,
      assignedBy: actorId,
    });

    await auditEventService.record({
      tenantId: problem.company,
      actorId,
      action: "problem.created",
      resourceType: "Problem",
      resourceId: problem._id,
      after: problem.toObject(),
    });

    events.emit("problem.created", {
      problemId: problem._id,
      tenantId: problem.company,
    });

    return problem;
  }

  static async getById(problemId, tenantId) {
    const problem = await Problem.findOne({
      _id: problemId,
      company: tenantId,
      isActive: true,
    });
    if (!problem) throw new ApiError(404, "Problem not found");
    return problem;
  }

  static async list(tenantId, filters = {}) {
    const query = { company: tenantId, isActive: true };
    if (filters.status) query.status = filters.status;
    if (filters.priority) query.priority = filters.priority;
    if (filters.assignedTo) query.assignedTo = filters.assignedTo;
    if (filters.assignmentGroup)
      query.assignmentGroup = filters.assignmentGroup;
    if (filters.knownError !== undefined) query.knownError = filters.knownError;
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
      Problem.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("assignedTo", "name email")
        .populate("assignmentGroup", "name"),
      Problem.countDocuments(query),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  static async update(problemId, data, tenantId, actorId) {
    const problem = await this.getById(problemId, tenantId);

    if (data.status && data.status !== problem.status) {
      assertTransition("problem", problem.status, data.status);
    }

    const before = problem.toObject();
    Object.assign(problem, data, { updatedBy: actorId });

    if (
      data.assignedTo &&
      String(data.assignedTo) !== String(problem.assignedTo)
    ) {
      await ProblemAssignmentHistory.create({
        problem: problem._id,
        company: tenantId,
        assignmentType: "reassignment",
        fromAgent: before.assignedTo,
        toAgent: data.assignedTo,
        assignedBy: actorId,
      });
    }

    await problem.save();

    await auditEventService.record({
      tenantId,
      actorId,
      action: "problem.updated",
      resourceType: "Problem",
      resourceId: problem._id,
      before,
      after: problem.toObject(),
    });

    events.emit("problem.updated", { problemId: problem._id, tenantId });

    return problem;
  }

  static async transition(
    problemId,
    targetStatus,
    tenantId,
    actorId,
    notes = "",
  ) {
    const problem = await this.getById(problemId, tenantId);
    assertTransition("problem", problem.status, targetStatus);

    const before = problem.toObject();
    const previousStatus = problem.status;
    problem.status = targetStatus;
    problem.updatedBy = actorId;

    if (targetStatus === "resolved") {
      problem.resolvedAt = new Date();
    } else if (targetStatus === "closed") {
      problem.closedAt = new Date();
      problem.permanentFixVerified = true;
    }

    problem.timeline.push({
      at: new Date(),
      by: actorId ? String(actorId) : "system",
      message: `Status changed from ${previousStatus} to ${targetStatus}${notes ? ": " + notes : ""}`,
    });

    await problem.save();

    if (targetStatus === "closed") {
      await this.resolveLinkedIncidentsWithFixContext(
        problemId,
        tenantId,
        actorId,
      );
    }

    await auditEventService.record({
      tenantId,
      actorId,
      action: "problem.transition",
      resourceType: "Problem",
      resourceId: problem._id,
      before,
      after: problem.toObject(),
    });

    events.emit("problem.updated", { problemId: problem._id, tenantId });

    return problem;
  }

  static async assign(problemId, assignment, tenantId, actorId) {
    const problem = await this.getById(problemId, tenantId);
    const before = problem.toObject();

    if (assignment.assignedTo) problem.assignedTo = assignment.assignedTo;
    if (assignment.assignmentGroup)
      problem.assignmentGroup = assignment.assignmentGroup;
    problem.updatedBy = actorId;

    await problem.save();

    await ProblemAssignmentHistory.create({
      problem: problem._id,
      company: tenantId,
      assignmentType: assignment.type || "reassignment",
      fromAgent: before.assignedTo,
      fromGroup: before.assignmentGroup,
      toAgent: assignment.assignedTo || problem.assignedTo,
      toGroup: assignment.assignmentGroup || problem.assignmentGroup,
      reason: assignment.reason || "",
      assignedBy: actorId,
    });

    return problem;
  }

  static async addComment(problemId, comment, tenantId, actorId) {
    const problem = await this.getById(problemId, tenantId);
    problem.timeline.push({
      at: new Date(),
      by: actorId ? String(actorId) : "system",
      message: comment.message,
    });
    problem.updatedBy = actorId;
    await problem.save();
    return problem;
  }

  static async linkIncident(problemId, incidentId, tenantId, actorId) {
    const incident = await Incident.findOne({
      _id: incidentId,
      company: tenantId,
      isActive: true,
    });
    if (!incident) throw new ApiError(404, "Incident not found");

    const existing = await ProblemIncident.findOne({
      problem: problemId,
      incident: incidentId,
      company: tenantId,
    });
    if (existing) {
      existing.isActive = true;
      await existing.save();
      return existing;
    }

    return ProblemIncident.create({
      problem: problemId,
      incident: incidentId,
      company: tenantId,
      linkedBy: actorId,
    });
  }

  static async unlinkIncident(problemId, incidentId, tenantId) {
    return ProblemIncident.findOneAndUpdate(
      { problem: problemId, incident: incidentId, company: tenantId },
      { isActive: false },
      { new: true },
    );
  }

  static async listIncidents(problemId, tenantId) {
    return ProblemIncident.find({
      problem: problemId,
      company: tenantId,
      isActive: true,
    }).populate("incident");
  }

  static async linkCI(problemId, ciId, role, tenantId, actorId) {
    await assertTenantOf(ConfigurationItem, ciId, tenantId, "configuration item");
    const existing = await ProblemCI.findOne({ problem: problemId, ci: ciId });
    if (existing) {
      existing.role = role || existing.role;
      existing.isActive = true;
      await existing.save();
      return existing;
    }

    return ProblemCI.create({
      problem: problemId,
      ci: ciId,
      company: tenantId,
      role: role || "affected",
      linkedBy: actorId,
    });
  }

  static async unlinkCI(problemId, ciId, tenantId) {
    return ProblemCI.findOneAndUpdate(
      { problem: problemId, ci: ciId, company: tenantId },
      { isActive: false },
      { new: true },
    );
  }

  static async listCIs(problemId, tenantId) {
    return ProblemCI.find({
      problem: problemId,
      company: tenantId,
      isActive: true,
    }).populate("ci");
  }

  static async linkServiceOffering(
    problemId,
    serviceOfferingId,
    role,
    tenantId,
    actorId,
  ) {
    await assertTenantOf(ServiceOffering, serviceOfferingId, tenantId, "service offering");
    const existing = await ProblemServiceOffering.findOne({
      problem: problemId,
      serviceOffering: serviceOfferingId,
    });
    if (existing) {
      existing.role = role || existing.role;
      existing.isActive = true;
      await existing.save();
      return existing;
    }

    return ProblemServiceOffering.create({
      problem: problemId,
      serviceOffering: serviceOfferingId,
      company: tenantId,
      role: role || "affected",
      linkedBy: actorId,
    });
  }

  static async linkChange(
    problemId,
    changeId,
    relationshipType,
    tenantId,
    actorId,
  ) {
    await assertTenantOf(Change, changeId, tenantId, "change");
    const existing = await ProblemChange.findOne({
      problem: problemId,
      change: changeId,
    });
    if (existing) {
      existing.relationshipType = relationshipType || existing.relationshipType;
      existing.isActive = true;
      await existing.save();
      return existing;
    }

    return ProblemChange.create({
      problem: problemId,
      change: changeId,
      company: tenantId,
      relationshipType: relationshipType || "remediation",
      linkedBy: actorId,
    });
  }

  static async listChanges(problemId, tenantId) {
    return ProblemChange.find({
      problem: problemId,
      company: tenantId,
      isActive: true,
    }).populate("change");
  }

  static async linkKnowledge(
    problemId,
    knowledgeArticleId,
    role,
    tenantId,
    actorId,
  ) {
    await assertTenantOf(Faq, knowledgeArticleId, tenantId, "knowledge article");
    const existing = await ProblemKnowledge.findOne({
      problem: problemId,
      knowledgeArticle: knowledgeArticleId,
    });
    if (existing) {
      existing.role = role || existing.role;
      existing.isActive = true;
      await existing.save();
      return existing;
    }

    return ProblemKnowledge.create({
      problem: problemId,
      knowledgeArticle: knowledgeArticleId,
      company: tenantId,
      role: role || "related",
      linkedBy: actorId,
    });
  }

  static async createTask(problemId, taskData, tenantId, actorId) {
    const count = await ProblemTask.countDocuments({ problem: problemId });
    const number = `PRT-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    return ProblemTask.create({
      ...taskData,
      number,
      problem: problemId,
      company: tenantId,
      createdBy: actorId,
    });
  }

  static async listTasks(problemId, tenantId, filters = {}) {
    const query = { problem: problemId, company: tenantId, isActive: true };
    if (filters.status) query.status = filters.status;
    return ProblemTask.find(query).sort({ createdAt: -1 });
  }

  static async publishWorkaround(problemId, tenantId, actorId) {
    const problem = await this.getById(problemId, tenantId);
    problem.workaroundPublished = true;
    problem.updatedBy = actorId;
    problem.timeline.push({
      at: new Date(),
      by: actorId ? String(actorId) : "system",
      message: "Workaround published",
    });
    await problem.save();
    const pushed = await this.pushWorkaroundToIncidents(
      problemId,
      tenantId,
      actorId,
    );

    await auditEventService.record({
      tenantId,
      actorId,
      action: "problem.workaround_published",
      resourceType: "Problem",
      resourceId: problem._id,
      after: { incidentCount: pushed.length },
    });

    events.emit("problem.updated", { problemId: problem._id, tenantId });
    return problem;
  }

  static async pushWorkaroundToIncidents(problemId, tenantId, actorId) {
    const problem = await this.getById(problemId, tenantId);
    if (!problem.workaround) return [];

    const links = await ProblemIncident.find({
      problem: problemId,
      company: tenantId,
      isActive: true,
    });

    const updated = [];
    for (const link of links) {
      const incident = await Incident.findById(link.incident);
      if (!incident) continue;
      if (["resolved", "closed", "canceled"].includes(incident.status)) {
        continue;
      }

      await IncidentResolution.create({
        incident: incident._id,
        problem: problemId,
        company: tenantId,
        resolutionCode: "workaround",
        notes: `Workaround pushed from Problem ${problem.number}`,
        workaround: problem.workaround,
        resolvedBy: actorId,
        resolvedAt: new Date(),
        source: "problem_workaround_push",
      });

      let timeline = incident.timeline;
      if (typeof timeline === "string") {
        try {
          timeline = JSON.parse(timeline);
        } catch (_) {
          timeline = [];
        }
      }
      timeline.push({
        at: new Date(),
        by: actorId ? String(actorId) : "system",
        message: `Workaround received from Problem ${problem.number}`,
      });
      incident.timeline = timeline;
      incident.updatedAt = new Date();
      await incident.save();

      updated.push({
        incidentId: incident._id,
        workaround: problem.workaround,
      });
    }

    if (updated.length) {
      await auditEventService.record({
        tenantId,
        actorId,
        action: "problem.workaround_pushed_to_incidents",
        resourceType: "Problem",
        resourceId: problem._id,
        after: { incidentCount: updated.length },
      });
    }

    return updated;
  }

  static async resolveLinkedIncidentsWithFixContext(
    problemId,
    tenantId,
    actorId,
  ) {
    const problem = await this.getById(problemId, tenantId);

    const links = await ProblemIncident.find({
      problem: problemId,
      company: tenantId,
      isActive: true,
    });

    const updated = [];
    for (const link of links) {
      const incident = await Incident.findById(link.incident);
      if (!incident) continue;
      if (["resolved", "closed", "canceled"].includes(incident.status)) {
        continue;
      }

      const resolvedAt = new Date();
      incident.status = "resolved";
      incident.resolvedAt = resolvedAt;

      let timeline = incident.timeline;
      if (typeof timeline === "string") {
        try {
          timeline = JSON.parse(timeline);
        } catch (_) {
          timeline = [];
        }
      }
      timeline.push({
        at: resolvedAt,
        by: actorId ? String(actorId) : "system",
        message: `Resolved via permanent fix from Problem ${problem.number}`,
      });
      incident.timeline = timeline;
      incident.updatedAt = resolvedAt;
      await incident.save();

      await IncidentResolution.create({
        incident: incident._id,
        problem: problemId,
        company: tenantId,
        resolutionCode: "permanent_fix",
        notes: `Resolved via permanent fix from Problem ${problem.number}`,
        rootCause: problem.rootCause || "",
        rootCauseCategory: "permanent_fix",
        workaround: problem.workaround || "",
        resolvedBy: actorId,
        resolvedAt,
        source: "problem_permanent_fix",
      });

      updated.push({ incidentId: incident._id });
    }

    if (updated.length) {
      await auditEventService.record({
        tenantId,
        actorId,
        action: "problem.permanent_fix_applied_to_incidents",
        resourceType: "Problem",
        resourceId: problem._id,
        after: { incidentCount: updated.length },
      });
    }

    return updated;
  }

  static async acceptRisk(problemId, reason, tenantId, actorId) {
    return this.transition(
      problemId,
      "risk_accepted",
      tenantId,
      actorId,
      reason,
    );
  }

  static async reanalyze(problemId, tenantId, actorId) {
    return this.transition(
      problemId,
      "assess",
      tenantId,
      actorId,
      "Re-analyzing",
    );
  }

  static async getAssignmentHistory(problemId, tenantId) {
    return ProblemAssignmentHistory.find({
      problem: problemId,
      company: tenantId,
    }).sort({ assignedAt: -1 });
  }

  static async createKnownError(problemId, data, tenantId, actorId) {
    const problem = await this.getById(problemId, tenantId);
    const count = await KnownError.countDocuments({ company: tenantId });
    const number = `KE-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const ke = await KnownError.create({
      ...data,
      number,
      problem: problemId,
      company: tenantId,
      createdBy: actorId,
    });

    problem.knownError = true;
    problem.knownErrorId = ke._id;
    await problem.save();

    return ke;
  }

  static async listKnownErrors(tenantId, filters = {}) {
    const query = { company: tenantId };
    if (filters.status) query.status = filters.status;
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 25, 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      KnownError.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("problem", "number title"),
      KnownError.countDocuments(query),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  static async createRootCauseRecord(problemId, data, tenantId, actorId) {
    return RootCauseRecord.create({
      ...data,
      problem: problemId,
      company: tenantId,
      identifiedBy: actorId,
    });
  }

  static async listRootCauseRecords(problemId, tenantId) {
    return RootCauseRecord.find({ problem: problemId, company: tenantId }).sort(
      { identifiedAt: -1 },
    );
  }
}

module.exports = ProblemService;
