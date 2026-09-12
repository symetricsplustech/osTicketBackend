const mongoose = require("mongoose");

const changeImplementationResultSchema = new mongoose.Schema(
  {
    change: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Change",
      required: true,
      index: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    outcome: {
      type: String,
      enum: ["successful", "partially_successful", "failed", "rolled_back"],
      required: true,
    },
    actualStart: { type: Date, default: null },
    actualEnd: { type: Date, default: null },
    duration: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    issuesEncountered: [{ type: String }],
    backoutExecuted: { type: Boolean, default: false },
    backoutNotes: { type: String, default: "" },
    implementedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

changeImplementationResultSchema.index(
  { company: 1, change: 1 },
  { unique: true },
);

module.exports = mongoose.model(
  "ChangeImplementationResult",
  changeImplementationResultSchema,
);
