const { Schema, model } = require("mongoose");
const ServiceOwnerSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: "BusinessService",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: [
        "business_owner",
        "technical_owner",
        "service_manager",
        "support_lead",
        "product_manager",
        "stakeholder",
      ],
      default: "business_owner",
    },
    isPrimary: { type: Boolean, default: false },
    assignedAt: { type: Date, default: Date.now },
    removedAt: { type: Date },
    responsibilities: [{ type: String }],
    escalationContact: { type: Boolean, default: true },
    notificationPreferences: { type: Schema.Types.Mixed, default: {} },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
ServiceOwnerSchema.index({ tenantId: 1, serviceId: 1, userId: 1 });
ServiceOwnerSchema.index({ tenantId: 1, userId: 1, role: 1 });
module.exports = model("ServiceOwner", ServiceOwnerSchema);
