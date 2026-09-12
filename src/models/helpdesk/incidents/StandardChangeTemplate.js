const mongoose = require("mongoose");

const standardChangeTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    description: { type: String, default: "" },
    category: { type: String, default: "" },
    risk: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "low",
    },
    implementationPlan: { type: String, default: "" },
    testPlan: { type: String, default: "" },
    rollbackPlan: { type: String, default: "" },
    validationPlan: { type: String, default: "" },
    defaultAssignmentGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
    },
    useCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

standardChangeTemplateSchema.index({ company: 1, isActive: 1 });

module.exports = mongoose.model(
  "StandardChangeTemplate",
  standardChangeTemplateSchema,
);
