const { Schema, model } = require("mongoose");
const ServicePortfolioSchema = new Schema(
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
    status: {
      type: String,
      enum: ["draft", "active", "archived", "retired"],
      default: "draft",
      index: true,
    },
    ownerId: { type: Schema.Types.ObjectId, ref: "User" },
    ownerGroupId: { type: Schema.Types.ObjectId, ref: "Team" },
    governance: {
      requiresApproval: { type: Boolean, default: true },
      approvalGroupId: { type: Schema.Types.ObjectId, ref: "Team" },
      reviewFrequencyDays: { type: Number, default: 365 },
      lastReviewedAt: { type: Date },
      nextReviewAt: { type: Date },
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
ServicePortfolioSchema.index({ tenantId: 1, status: 1, isDeleted: 1 });
module.exports = model("ServicePortfolio", ServicePortfolioSchema);
