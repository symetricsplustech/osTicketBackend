const { Schema, model } = require("mongoose");
const RosterSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    scheduleId: {
      type: Schema.Types.ObjectId,
      ref: "OnCallSchedule",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
    rotation: { type: Schema.Types.ObjectId, ref: "Rotation" },
    assignedMembers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    minCoverage: { type: Number, default: 1 },
    maxCoverage: { type: Number, default: 2 },
    handoverWindow: { type: String, default: "09:00-09:30" },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
RosterSchema.index({ tenantId: 1, scheduleId: 1, status: 1, isDeleted: 1 });
module.exports = model("Roster", RosterSchema);
