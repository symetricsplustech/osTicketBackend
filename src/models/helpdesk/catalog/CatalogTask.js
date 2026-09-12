/**
 * CatalogTask — fulfillment task for a requested item (SCTASK).
 * Tasks are generated from fulfillment plans and run sequentially or in parallel.
 * States: open, work_in_progress, closed_complete, closed_incomplete, closed_skipped
 */
const { Schema, model } = require("mongoose");

const CatalogTaskSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    requestedItemId: {
      type: Schema.Types.ObjectId,
      ref: "RequestedItem",
      required: true,
      index: true,
    },
    requestId: {
      type: Schema.Types.ObjectId,
      ref: "Request",
      required: true,
      index: true,
    },
    number: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: [
        "open",
        "work_in_progress",
        "closed_complete",
        "closed_incomplete",
        "closed_skipped",
      ],
      default: "open",
      index: true,
    },

    // Ordering
    order: { type: Number, required: true, index: true },
    parallelGroup: { type: String },
    executionType: {
      type: String,
      enum: ["sequential", "parallel"],
      default: "sequential",
    },

    // Actors
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    assignmentGroup: { type: Schema.Types.ObjectId, ref: "Group" },
    fulfillmentTeam: { type: Schema.Types.ObjectId, ref: "Team" },

    // Execution
    startedAt: { type: Date },
    completedAt: { type: Date },
    estimatedDuration: { type: Number },
    actualDuration: { type: Number },

    // Close
    closeCode: { type: String, enum: ["complete", "incomplete", "skipped"] },
    closeNotes: { type: String },
    closedBy: { type: Schema.Types.ObjectId, ref: "User" },

    // Dependencies
    dependsOn: [{ type: Schema.Types.ObjectId, ref: "CatalogTask" }],
    blocks: [{ type: Schema.Types.ObjectId, ref: "CatalogTask" }],

    meta: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

CatalogTaskSchema.index({
  tenantId: 1,
  requestedItemId: 1,
  order: 1,
  isDeleted: 1,
});
CatalogTaskSchema.index({ tenantId: 1, status: 1, assignedTo: 1 });

module.exports = model("CatalogTask", CatalogTaskSchema);
