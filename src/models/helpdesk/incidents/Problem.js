const mongoose = require("mongoose");

const problemSchema = new mongoose.Schema(
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
    status: {
      type: String,
      enum: [
        "new",
        "assess",
        "root_cause_analysis",
        "fix_in_progress",
        "resolved",
        "closed",
        "canceled",
        "risk_accepted",
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
    rootCause: { type: String, default: "" },
    rootCauseCategory: {
      type: String,
      enum: [
        "code_defect",
        "configuration",
        "infrastructure",
        "third_party",
        "human_error",
        "process_gap",
        "unknown",
      ],
      default: "unknown",
    },
    workaround: { type: String, default: "" },
    workaroundPublished: { type: Boolean, default: false },
    permanentSolution: { type: String, default: "" },
    riskAccepted: { type: Boolean, default: false },
    riskAcceptanceReason: { type: String, default: "" },
    knownError: { type: Boolean, default: false },
    knownErrorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KnownError",
      default: null,
      index: true,
    },
    linkedIncidents: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Incident" },
    ],
    linkedChanges: [{ type: mongoose.Schema.Types.ObjectId, ref: "Change" }],
    linkedKnowledge: [{ type: mongoose.Schema.Types.ObjectId, ref: "Faq" }],
    postmortem: { type: String, default: "" },
    timeline: [
      {
        at: { type: Date, default: Date.now },
        by: { type: String, default: "" },
        message: { type: String, default: "" },
      },
    ],
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

problemSchema.index({ company: 1, status: 1 });
problemSchema.index({ company: 1, priority: 1 });
problemSchema.index({ company: 1, assignedTo: 1 });
problemSchema.index({ company: 1, assignmentGroup: 1 });
problemSchema.index({ isActive: 1, deletedAt: 1 });

problemSchema.statics.STATUSES = [
  "new",
  "assess",
  "root_cause_analysis",
  "fix_in_progress",
  "resolved",
  "closed",
  "canceled",
  "risk_accepted",
];

problemSchema.statics.PRIORITIES = ["Low", "Normal", "High", "Emergency"];

problemSchema.statics.ROOT_CAUSE_CATEGORIES = [
  "code_defect",
  "configuration",
  "infrastructure",
  "third_party",
  "human_error",
  "process_gap",
  "unknown",
];

module.exports =
  mongoose.models.Problem || mongoose.model("Problem", problemSchema);
