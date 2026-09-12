const { Schema, model } = require("mongoose");
const SLARepairJobSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    number: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed", "cancelled"],
      default: "pending",
      index: true,
    },
    triggeredBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    triggerReason: { type: String, trim: true, default: "" },
    triggerType: {
      type: String,
      enum: [
        "sla_plan_change",
        "schedule_change",
        "holiday_change",
        "manual",
        "bulk_import",
      ],
      required: true,
    },
    slaPlanId: { type: Schema.Types.ObjectId, ref: "SlaPlan" },
    affectedTicketCount: { type: Number, default: 0 },
    processedCount: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    failureCount: { type: Number, default: 0 },
    startedAt: { type: Date },
    completedAt: { type: Date },
    actualDuration: { type: Number },
    errors: [
      {
        ticketId: { type: Schema.Types.ObjectId },
        error: { type: String },
        timestamp: { type: Date },
      },
    ],
    meta: { type: Schema.Types.Mixed, default: {} },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
SLARepairJobSchema.index({ tenantId: 1, status: 1, isDeleted: 1 });
module.exports = model("SLARepairJob", SLARepairJobSchema);
