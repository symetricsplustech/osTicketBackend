/**
 * KnowledgeBase — top-level container for knowledge articles.
 * Groups categories and articles into logical knowledge bases.
 */
const { Schema, model } = require("mongoose");

const KnowledgeBaseSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    number: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    icon: { type: String, default: "BookOpen" },
    color: { type: String, default: "#3B82F6" },

    // Visibility
    visibility: {
      type: String,
      enum: ["public", "customers", "employees", "agents"],
      default: "public",
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },

    // Ownership
    owner: { type: Schema.Types.ObjectId, ref: "User" },
    managerGroup: { type: Schema.Types.ObjectId, ref: "Group" },

    // Metrics
    articleCount: { type: Number, default: 0 },
    totalViews: { type: Number, default: 0 },

    // Settings
    allowComments: { type: Boolean, default: true },
    allowRatings: { type: Boolean, default: true },
    requireApproval: { type: Boolean, default: false },
    autoExpireDays: { type: Number },
    reviewCycleDays: { type: Number },

    meta: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

KnowledgeBaseSchema.index({ tenantId: 1, isActive: 1, isDeleted: 1 });
KnowledgeBaseSchema.index(
  { tenantId: 1, name: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);

module.exports = model("KnowledgeBase", KnowledgeBaseSchema);
