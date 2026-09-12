const { Schema, model } = require("mongoose");
const ApprovalDecisionSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    instanceId: {
      type: Schema.Types.ObjectId,
      ref: "ApprovalInstance",
      required: true,
      index: true,
    },
    stepId: {
      type: Schema.Types.ObjectId,
      ref: "ApprovalStep",
      required: true,
    },
    approverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    approverName: { type: String, default: "" },
    decision: {
      type: String,
      enum: ["approved", "rejected", "skipped", "delegated", "expired"],
      required: true,
      index: true,
    },
    comment: { type: String, trim: true, default: "" },
    delegatedTo: { type: Schema.Types.ObjectId, ref: "User" },
    delegatedToName: { type: String },
    delegationNote: { type: String, default: "" },
    isAutoDecision: { type: Boolean, default: false },
    autoReason: {
      type: String,
      enum: ["timeout", "escalation", "policy", "delegation_chain", null],
    },
    ipAddress: { type: String },
    userAgent: { type: String },
    correlationId: { type: String, index: true },
    duration: { type: Number },
  },
  { timestamps: true },
);
ApprovalDecisionSchema.index({ tenantId: 1, instanceId: 1, createdAt: -1 });
module.exports = model("ApprovalDecision", ApprovalDecisionSchema);
