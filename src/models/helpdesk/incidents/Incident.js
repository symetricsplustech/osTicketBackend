const mongoose = require("mongoose");

const incidentSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true, index: true },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    summary: { type: String, default: "" },
    severity: {
      type: String,
      enum: ["Sev1", "Sev2", "Sev3", "Sev4"],
      default: "Sev3",
    },
    status: {
      type: String,
      enum: [
        "new",
        "in_progress",
        "on_hold_caller",
        "on_hold_change",
        "on_hold_problem",
        "on_hold_vendor",
        "resolved",
        "closed",
        "canceled",
        "investigating",
        "identified",
        "monitoring",
      ],
      default: "new",
    },
    priority: {
      type: String,
      enum: ["Low", "Normal", "High", "Emergency"],
      default: "Normal",
    },
    impact: { type: String, enum: ["1", "2", "3", "4"], default: "3" },
    urgency: { type: String, enum: ["1", "2", "3", "4"], default: "3" },
    category: { type: String, default: "" },
    subcategory: { type: String, default: "" },
    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    affectedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    assignmentGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    commander: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      default: null,
    },
    resolutionTeam: [{ type: mongoose.Schema.Types.ObjectId, ref: "Agent" }],
    isMajor: { type: Boolean, default: false, index: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
    parentIncident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Incident",
      default: null,
      index: true,
    },
    affectedTickets: [{ type: mongoose.Schema.Types.ObjectId, ref: "Ticket" }],
    affectedServices: { type: [String], default: [] },
    incidentCommander: { type: String, default: "" },
    timeline: [
      {
        at: { type: Date, default: Date.now },
        by: { type: String, default: "" },
        message: { type: String, default: "" },
      },
    ],
    updates: [
      {
        at: { type: Date, default: Date.now },
        status: { type: String, default: "" },
        message: { type: String, default: "" },
      },
    ],
    rootCase: { type: String, default: "" },
    rootCause: { type: String, default: "" },
    workaround: { type: String, default: "" },
    postmortem: { type: String, default: "" },
    resolution: { type: String, default: "" },
    resolutionCode: {
      type: String,
      enum: [
        "fixed",
        "workaround",
        "duplicate",
        "not_reproducible",
        "not_a_bug",
        "user_error",
        "by_design",
        "third_party",
        "will_not_fix",
      ],
      default: null,
    },
    slaDue: { type: Date, default: null },
    responseSlaDue: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    canceledAt: { type: Date, default: null },
    startedAt: { type: Date, default: Date.now },
    holdReason: { type: String, default: "" },
    notifiedStakeholders: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      default: null,
    },
  },
  { timestamps: true },
);

incidentSchema.index({ company: 1, status: 1 });
incidentSchema.index({ company: 1, priority: 1 });
incidentSchema.index({ company: 1, assignedTo: 1 });
incidentSchema.index({ company: 1, assignmentGroup: 1 });
incidentSchema.index({ company: 1, category: 1, subcategory: 1 });
incidentSchema.index({ parentIncident: 1 });
incidentSchema.index({ isActive: 1, deletedAt: 1 });
incidentSchema.index({ number: 1 }, { unique: true });

incidentSchema.statics.STATUSES = [
  "new",
  "in_progress",
  "on_hold_caller",
  "on_hold_change",
  "on_hold_problem",
  "on_hold_vendor",
  "resolved",
  "closed",
  "canceled",
  "investigating",
  "identified",
  "monitoring",
];

incidentSchema.statics.SEVERITIES = ["Sev1", "Sev2", "Sev3", "Sev4"];

incidentSchema.statics.PRIORITIES = ["Low", "Normal", "High", "Emergency"];

incidentSchema.statics.RESOLUTION_CODES = [
  "fixed",
  "workaround",
  "duplicate",
  "not_reproducible",
  "not_a_bug",
  "user_error",
  "by_design",
  "third_party",
  "will_not_fix",
];

incidentSchema.statics.IMPACT_URGENCY_PRIORITY = {
  "1-1": "Emergency",
  "1-2": "Emergency",
  "1-3": "High",
  "1-4": "High",
  "2-1": "Emergency",
  "2-2": "High",
  "2-3": "High",
  "2-4": "Normal",
  "3-1": "High",
  "3-2": "Normal",
  "3-3": "Normal",
  "3-4": "Low",
  "4-1": "Normal",
  "4-2": "Normal",
  "4-3": "Low",
  "4-4": "Low",
};

incidentSchema.statics.calculatePriority = function (impact, urgency) {
  const key = `${impact}-${urgency}`;
  return this.IMPACT_URGENCY_PRIORITY[key] || "Normal";
};

incidentSchema.statics.HOLD_REASONS = [
  "awaiting_caller",
  "awaiting_change",
  "awaiting_problem",
  "awaiting_vendor",
];

module.exports =
  mongoose.models.Incident || mongoose.model("Incident", incidentSchema);
