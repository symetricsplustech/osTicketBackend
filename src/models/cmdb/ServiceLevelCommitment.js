const { Schema, model } = require("mongoose");
const ServiceLevelCommitmentSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    number: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: [
        "availability",
        "response_time",
        "resolution_time",
        "throughput",
        "capacity",
        "security",
        "custom",
      ],
      required: true,
      index: true,
    },
    scope: {
      type: String,
      enum: ["service", "offering", "customer", "global"],
      default: "service",
    },
    targetValue: { type: Number, required: true },
    targetUnit: {
      type: String,
      required: true,
      enum: [
        "percent",
        "minutes",
        "hours",
        "seconds",
        "ms",
        "count",
        "mbps",
        "gbps",
        "iops",
        "custom",
      ],
    },
    measurementWindow: {
      type: String,
      enum: ["daily", "weekly", "monthly", "quarterly", "annual"],
      default: "monthly",
    },
    businessHoursOnly: { type: Boolean, default: false },
    scheduleId: { type: Schema.Types.ObjectId, ref: "BusinessSchedule" },
    escalationPolicyId: {
      type: Schema.Types.ObjectId,
      ref: "EscalationPolicy",
    },
    penalty: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["draft", "active", "suspended", "retired"],
      default: "draft",
      index: true,
    },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
ServiceLevelCommitmentSchema.index({
  tenantId: 1,
  type: 1,
  status: 1,
  isDeleted: 1,
});
module.exports = model("ServiceLevelCommitment", ServiceLevelCommitmentSchema);
