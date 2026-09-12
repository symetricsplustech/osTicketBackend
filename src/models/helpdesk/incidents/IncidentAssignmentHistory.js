const mongoose = require("mongoose");

const incidentAssignmentHistorySchema = new mongoose.Schema(
  {
    incident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Incident",
      required: true,
      index: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    assignmentType: {
      type: String,
      enum: ["initial", "reassignment", "escalation", "delegation"],
      required: true,
    },
    fromGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
    },
    fromAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    toGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
    },
    toAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reason: { type: String, default: "" },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    assignedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

incidentAssignmentHistorySchema.index({
  company: 1,
  incident: 1,
  assignedAt: -1,
});

module.exports = mongoose.model(
  "IncidentAssignmentHistory",
  incidentAssignmentHistorySchema,
);
