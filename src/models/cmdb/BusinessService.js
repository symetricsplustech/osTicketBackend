const { Schema, model } = require("mongoose");
const BusinessServiceSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    portfolioId: {
      type: Schema.Types.ObjectId,
      ref: "ServicePortfolio",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    number: { type: String, required: true, unique: true },
    category: {
      type: String,
      enum: [
        "customer_facing",
        "supporting",
        "infrastructure",
        "application",
        "platform",
        "network",
        "security",
        "other",
      ],
      default: "customer_facing",
      index: true,
    },
    criticality: {
      type: String,
      enum: ["critical", "high", "medium", "low", "non_critical"],
      default: "medium",
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "active", "degraded", "outage", "maintenance", "retired"],
      default: "draft",
      index: true,
    },
    ownerId: { type: Schema.Types.ObjectId, ref: "User" },
    ownerGroupId: { type: Schema.Types.ObjectId, ref: "Team" },
    supportGroupId: { type: Schema.Types.ObjectId, ref: "Team" },
    availabilityTarget: { type: Number, default: 99.9 },
    availabilityTargetUnit: { type: String, default: "percent" },
    operatingHours: {
      timezone: { type: String, default: "UTC" },
      schedule: { type: Schema.Types.ObjectId, ref: "BusinessSchedule" },
      exceptions: [{ date: { type: Date }, description: { type: String } }],
    },
    serviceLevelCommitments: [
      { type: Schema.Types.ObjectId, ref: "ServiceLevelCommitment" },
    ],
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
BusinessServiceSchema.index({
  tenantId: 1,
  portfolioId: 1,
  status: 1,
  isDeleted: 1,
});
BusinessServiceSchema.index({ tenantId: 1, criticality: 1, status: 1 });
module.exports = model("BusinessService", BusinessServiceSchema);
