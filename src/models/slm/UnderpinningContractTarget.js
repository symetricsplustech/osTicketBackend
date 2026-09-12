const { Schema, model } = require("mongoose");
const UnderpinningContractTargetSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    contractId: {
      type: Schema.Types.ObjectId,
      ref: "Contract",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    number: { type: String, required: true, unique: true },
    metric: {
      type: String,
      required: true,
      enum: [
        "availability",
        "response_time",
        "resolution_time",
        "uptime",
        "throughput",
        "error_rate",
        "custom",
      ],
    },
    description: { type: String, trim: true, default: "" },
    targetValue: { type: Number, required: true },
    targetUnit: {
      type: String,
      required: true,
      enum: [
        "percent",
        "hours",
        "minutes",
        "ms",
        "seconds",
        "requests_per_second",
      ],
    },
    comparisonOperator: {
      type: String,
      enum: ["gte", "lte", "eq", "gt", "lt"],
      default: "gte",
    },
    measurementWindow: {
      type: String,
      enum: ["daily", "weekly", "monthly", "quarterly", "yearly"],
      default: "monthly",
    },
    currentActual: { type: Number, default: 0 },
    lastMeasuredAt: { type: Date },
    isActive: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["met", "at_risk", "breached", "not_measured"],
      default: "not_measured",
      index: true,
    },
    breachCount: { type: Number, default: 0 },
    lastBreachAt: { type: Date },
    meta: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
UnderpinningContractTargetSchema.index({
  tenantId: 1,
  contractId: 1,
  isActive: 1,
  isDeleted: 1,
});
module.exports = model(
  "UnderpinningContractTarget",
  UnderpinningContractTargetSchema,
);
