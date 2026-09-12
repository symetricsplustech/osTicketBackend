const { Schema, model } = require("mongoose");
const ShiftSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    scheduleId: {
      type: Schema.Types.ObjectId,
      ref: "OnCallSchedule",
      required: true,
      index: true,
    },
    name: { type: String, trim: true, default: "" },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    onCallAgent: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    secondaryAgent: { type: Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["scheduled", "active", "completed", "cancelled", "conflict"],
      default: "scheduled",
      index: true,
    },
    handoverNotes: { type: String, trim: true, default: "" },
    handoverCompleted: { type: Boolean, default: false },
    handoverCompletedAt: { type: Date },
    handoverCompletedBy: { type: Schema.Types.ObjectId, ref: "User" },
    escalationPolicySnapshot: { type: Schema.Types.Mixed, default: {} },
    coverageRequests: [{ type: Schema.Types.ObjectId, ref: "CoverageRequest" }],
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
ShiftSchema.index({ tenantId: 1, scheduleId: 1, startDate: 1, status: 1 });
ShiftSchema.index({ tenantId: 1, onCallAgent: 1, status: 1 });
module.exports = model("Shift", ShiftSchema);
