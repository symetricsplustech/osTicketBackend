const { Schema, model } = require("mongoose");
const SkillSchema = new Schema(
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
    category: {
      type: String,
      enum: [
        "technical",
        "language",
        "product",
        "soft_skill",
        "certification",
        "custom",
      ],
      default: "custom",
      index: true,
    },
    group: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    proficiencyLevels: {
      type: [String],
      default: ["beginner", "intermediate", "advanced", "expert"],
    },
    agentCount: { type: Number, default: 0 },
    requiredByRules: { type: Number, default: 0 },
    meta: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
SkillSchema.index({ tenantId: 1, isActive: 1, isDeleted: 1 });
module.exports = model("Skill", SkillSchema);
