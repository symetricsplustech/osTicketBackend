const { Schema, model } = require("mongoose");
const ServiceOfferingSchema = new Schema(
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
      enum: ["standard", "premium", "custom", "managed", "self_service"],
      default: "standard",
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "active", "retired", "suspended"],
      default: "draft",
      index: true,
    },
    category: {
      type: String,
      enum: [
        "incident",
        "request",
        "change",
        "access",
        "support",
        "consulting",
        "training",
        "managed",
        "other",
      ],
      default: "support",
    },
    pricing: {
      model: {
        type: String,
        enum: ["flat", "tiered", "usage", "subscription", "custom"],
        default: "flat",
      },
      basePrice: { type: Number, default: 0 },
      currency: { type: String, default: "USD" },
      tiers: [
        {
          name: { type: String },
          price: { type: Number },
          limits: { type: Schema.Types.Mixed },
        },
      ],
    },
    fulfillment: {
      requiresApproval: { type: Boolean, default: false },
      approvalGroupId: { type: Schema.Types.ObjectId, ref: "Team" },
      fulfillmentPlanId: {
        type: Schema.Types.ObjectId,
        ref: "FulfillmentPlan",
      },
      estimatedDeliveryDays: { type: Number, default: 0 },
    },
    slaCommitments: [
      { type: Schema.Types.ObjectId, ref: "ServiceLevelCommitment" },
    ],
    supportHours: {
      timezone: { type: String, default: "UTC" },
      schedule: { type: Schema.Types.ObjectId, ref: "BusinessSchedule" },
    },
    catalogItemId: { type: Schema.Types.ObjectId, ref: "CatalogItem" },
    status: {
      type: String,
      enum: ["draft", "active", "retired", "suspended"],
      default: "draft",
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
ServiceOfferingSchema.index({
  tenantId: 1,
  businessServiceId: 1,
  status: 1,
  isDeleted: 1,
});
module.exports = model("ServiceOffering", ServiceOfferingSchema);
