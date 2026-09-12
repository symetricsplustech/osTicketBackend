const mongoose = require("mongoose");

const cabDefinitionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    description: { type: String, default: "" },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    chair: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    meetingSchedule: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

cabDefinitionSchema.index({ company: 1, isActive: 1 });

module.exports = mongoose.model("CABDefinition", cabDefinitionSchema);
