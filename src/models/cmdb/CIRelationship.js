const { Schema, model } = require("mongoose");
const CIRelationshipSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    sourceCIId: {
      type: Schema.Types.ObjectId,
      ref: "ConfigurationItem",
      required: true,
      index: true,
    },
    targetCIId: {
      type: Schema.Types.ObjectId,
      ref: "ConfigurationItem",
      required: true,
      index: true,
    },
    relationshipType: {
      type: String,
      enum: [
        "depends_on",
        "runs_on",
        "hosts",
        "connects_to",
        "contains",
        "provides",
        "uses",
        "interfaces_with",
        "backs_up",
        "replicates_to",
        "monitors",
        "manages",
        "routes_to",
        "switches_to",
        "load_balances",
      ],
      required: true,
      index: true,
    },
    direction: {
      type: String,
      enum: ["source_to_target", "target_to_source", "bidirectional"],
      default: "source_to_target",
    },
    strength: {
      type: String,
      enum: ["strong", "weak", "conditional"],
      default: "strong",
    },
    isActive: { type: Boolean, default: true, index: true },
    description: { type: String, trim: true, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
CIRelationshipSchema.index({
  tenantId: 1,
  sourceCIId: 1,
  targetCIId: 1,
  relationshipType: 1,
  isDeleted: 1,
});
CIRelationshipSchema.index({ tenantId: 1, relationshipType: 1, isActive: 1 });
module.exports = model("CIRelationship", CIRelationshipSchema);
