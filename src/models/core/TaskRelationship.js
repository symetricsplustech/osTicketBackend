const mongoose = require("mongoose");

const taskRelationshipSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    sourceTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true,
    },
    targetTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true,
    },
    relationshipType: {
      type: String,
      enum: [
        "relates_to",
        "blocks",
        "blocked_by",
        "duplicates",
        "caused_by",
        "child_of",
        "parent_of",
      ],
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

taskRelationshipSchema.index({ tenantId: 1, sourceTaskId: 1 });
taskRelationshipSchema.index({ tenantId: 1, targetTaskId: 1 });
taskRelationshipSchema.index(
  { tenantId: 1, sourceTaskId: 1, targetTaskId: 1, relationshipType: 1 },
  { unique: true },
);

module.exports = mongoose.model("TaskRelationship", taskRelationshipSchema);
