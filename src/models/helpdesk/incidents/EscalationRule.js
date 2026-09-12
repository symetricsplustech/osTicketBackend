const mongoose = require("mongoose");

const ruleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
    priority: {
      type: String,
      enum: ["Low", "Normal", "High", "Emergency"],
      default: null,
    },
    statuses: { type: [String], default: ["open", "assigned", "overdue"] },
    overdueMinutes: { type: Number, default: 0, min: 0 },
    action: {
      raisePriorityTo: {
        type: String,
        enum: ["Low", "Normal", "High", "Emergency"],
        default: null,
      },
      reassignAgent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Agent",
        default: null,
      },
      reassignTeam: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Team",
        default: null,
      },
      notifyAgent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Agent",
        default: null,
      },
      setStatus: { type: String, default: "" },
    },
    // Tiered timeline (§16): evaluated against minutes since SLA start
    // (slaStartedAt, else createdAt). Each tier fires once per ticket.
    // Example: [{ afterMinutes: 30, notifyAgent }, { afterMinutes: 60,
    // reassignTeam, setStatus: 'escalated' }, { afterMinutes: 90,
    // raisePriorityTo: 'Emergency', webhookUrl }].
    tiers: [
      {
        afterMinutes: { type: Number, required: true, min: 0 },
        raisePriorityTo: {
          type: String,
          enum: ["Low", "Normal", "High", "Emergency"],
          default: null,
        },
        reassignAgent: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Agent",
          default: null,
        },
        reassignTeam: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Team",
          default: null,
        },
        notifyAgent: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Agent",
          default: null,
        },
        setStatus: { type: String, default: "" },
        webhookUrl: { type: String, default: "" },
      },
    ],
    isActive: { type: Boolean, default: true },
    lastRunAt: { type: Date, default: null },
  },
  { timestamps: true },
);

ruleSchema.index({ company: 1, isActive: 1 });

module.exports = mongoose.model("EscalationRule", ruleSchema);
