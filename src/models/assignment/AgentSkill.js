const { Schema, model } = require("mongoose");
const AgentSkillSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    agentId: {
      type: Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
      index: true,
    },
    skillId: {
      type: Schema.Types.ObjectId,
      ref: "Skill",
      required: true,
      index: true,
    },
    proficiency: {
      type: String,
      enum: ["beginner", "intermediate", "advanced", "expert"],
      default: "intermediate",
    },
    certified: { type: Boolean, default: false },
    certifiedAt: { type: Date },
    expiresAt: { type: Date },
    endorsedBy: { type: Schema.Types.ObjectId, ref: "Agent" },
    endorsedAt: { type: Date },
    primaryGroup: { type: Schema.Types.ObjectId, ref: "Team" },
    isActive: { type: Boolean, default: true },
    notes: { type: String, trim: true, default: "" },
    meta: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
AgentSkillSchema.index(
  { tenantId: 1, agentId: 1, skillId: 1 },
  { unique: true },
);
AgentSkillSchema.index({ tenantId: 1, skillId: 1, proficiency: 1 });
module.exports = model("AgentSkill", AgentSkillSchema);
