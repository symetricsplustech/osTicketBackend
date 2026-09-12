const mongoose = require("mongoose");

const handoverNoteSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    shiftDate: { type: Date, default: null },
    pendingTickets: { type: [String], default: [] },
    risks: { type: String, default: "" },
    notes: { type: String, default: "" },
    acknowledged: { type: Boolean, default: false },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      default: null,
    },
    acknowledgedAt: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      default: null,
    },
  },
  { timestamps: true },
);

handoverNoteSchema.index({ company: 1, shiftDate: 1 });

module.exports = mongoose.model("HandoverNote", handoverNoteSchema);