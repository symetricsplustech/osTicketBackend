const mongoose = require("mongoose");

const postIncidentReviewSchema = new mongoose.Schema(
  {
    incident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Incident",
      required: true,
      index: true,
    },
    majorIncident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MajorIncident",
      default: null,
      index: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "in_review", "approved", "published"],
      default: "draft",
      index: true,
    },
    title: { type: String, required: true, trim: true },
    summary: { type: String, default: "" },
    timeline: [
      {
        at: { type: Date, default: Date.now },
        event: { type: String, default: "" },
        impact: { type: String, default: "" },
      },
    ],
    rootCauseAnalysis: {
      rootCause: { type: String, default: "" },
      category: {
        type: String,
        enum: [
          "code_defect",
          "configuration",
          "infrastructure",
          "third_party",
          "process_gap",
          "human_error",
          "unknown",
        ],
        default: "unknown",
      },
      contributingFactors: [{ type: String }],
      detectionGap: { type: String, default: "" },
      responseGap: { type: String, default: "" },
    },
    actionItems: [
      {
        description: { type: String, default: "" },
        owner: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        dueDate: { type: Date, default: null },
        status: {
          type: String,
          enum: ["open", "in_progress", "completed", "cancelled"],
          default: "open",
        },
        completedAt: { type: Date, default: null },
      },
    ],
    lessonsLearned: [{ type: String }],
    improvementAreas: [{ type: String }],
    duration: { type: Number, default: 0 },
    impactSummary: {
      usersAffected: { type: Number, default: 0 },
      servicesAffected: [{ type: String }],
      revenueImpact: { type: String, default: "" },
      slaBreached: { type: Boolean, default: false },
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

postIncidentReviewSchema.index({ company: 1, incident: 1 });
postIncidentReviewSchema.index({ company: 1, status: 1 });

module.exports = mongoose.model("PostIncidentReview", postIncidentReviewSchema);
