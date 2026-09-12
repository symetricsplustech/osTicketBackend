/**
 * CatalogItem — individual purchasable/requestable item.
 * Enhanced version of ServiceCatalogItem with full lifecycle.
 */
const { Schema, model } = require("mongoose");

const CatalogItemSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    catalogId: {
      type: Schema.Types.ObjectId,
      ref: "Catalog",
      required: true,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "CatalogCategory",
      index: true,
    },
    name: { type: String, required: true, trim: true },
    number: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    icon: { type: String, default: "Package" },
    picture: { type: String },
    shortDescription: { type: String, trim: true, default: "" },

    // Ordering
    price: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "USD" },
    needsPayment: { type: Boolean, default: false },
    isBundle: { type: Boolean, default: false },
    bundleItems: [{ type: Schema.Types.ObjectId, ref: "CatalogItem" }],

    // Fulfillment
    estimatedDeliveryTime: { type: String },
    estimatedTime: { type: Number },
    autoFulfill: { type: Boolean, default: false },
    fulfillmentTemplate: {
      type: Schema.Types.ObjectId,
      ref: "FulfillmentPlan",
    },

    // Approval
    requiresApproval: { type: Boolean, default: false },
    approvalPolicy: {
      type: Schema.Types.ObjectId,
      ref: "ChangeApprovalPolicy",
    },
    approvalMode: {
      type: String,
      enum: ["individual", "group", "sequential", "parallel"],
      default: "individual",
    },
    approvers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    approvalGroups: [{ type: Schema.Types.ObjectId, ref: "Group" }],

    // Visibility & access
    visibleInPortal: { type: Boolean, default: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },

    // Linked entities
    helpTopic: { type: Schema.Types.ObjectId, ref: "HelpTopic" },
    department: { type: Schema.Types.ObjectId, ref: "Department" },
    sla: { type: Schema.Types.ObjectId, ref: "SLA" },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    formId: { type: Schema.Types.ObjectId, ref: "TicketForm" },

    // Assignment
    autoAssignAgent: { type: Boolean, default: false },
    autoAssignTeam: { type: Schema.Types.ObjectId, ref: "Team" },

    // Entitlement
    entitlementRequired: { type: Boolean, default: false },

    // Lifecycle
    publishedAt: { type: Date },
    publishedBy: { type: Schema.Types.ObjectId, ref: "User" },
    retiredAt: { type: Date },
    retiredBy: { type: Schema.Types.ObjectId, ref: "User" },

    meta: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

CatalogItemSchema.index({
  tenantId: 1,
  isActive: 1,
  visibleInPortal: 1,
  isDeleted: 1,
});
CatalogItemSchema.index({ tenantId: 1, categoryId: 1, sortOrder: 1 });
CatalogItemSchema.index({
  tenantId: 1,
  name: "text",
  title: "text",
  description: "text",
});

module.exports = model("CatalogItem", CatalogItemSchema);
