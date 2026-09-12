const { Schema, model } = require("mongoose");
const TechnicalServiceSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    businessServiceId: {
      type: Schema.Types.ObjectId,
      ref: "BusinessService",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    number: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: [
        "application",
        "database",
        "middleware",
        "infrastructure",
        "network",
        "storage",
        "security",
        "integration",
        "other",
      ],
      default: "application",
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "active", "degraded", "outage", "maintenance", "retired"],
      default: "draft",
      index: true,
    },
    environment: {
      type: String,
      enum: ["production", "staging", "development", "test", "dr"],
      default: "production",
      index: true,
    },
    technologyStack: [
      {
        name: { type: String },
        version: { type: String },
        vendor: { type: String },
      },
    ],
    hostingLocation: {
      type: String,
      enum: ["on_premise", "aws", "azure", "gcp", "colo", "hybrid", "saas"],
      default: "on_premise",
    },
    ownerId: { type: Schema.Types.ObjectId, ref: "User" },
    ownerGroupId: { type: Schema.Types.ObjectId, ref: "Team" },
    supportedBy: [{ type: Schema.Types.ObjectId, ref: "Team" }],
    dependencies: [
      {
        serviceId: { type: Schema.Types.ObjectId, ref: "TechnicalService" },
        dependencyType: {
          type: String,
          enum: ["requires", "provides", "connects_to", "hosts"],
        },
      },
    ],
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
TechnicalServiceSchema.index({
  tenantId: 1,
  businessServiceId: 1,
  status: 1,
  isDeleted: 1,
});
TechnicalServiceSchema.index({ tenantId: 1, environment: 1, status: 1 });
module.exports = model("TechnicalService", TechnicalServiceSchema);
