const mongoose = require("mongoose");

const cabAgendaItemSchema = new mongoose.Schema(
  {
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CABMeeting",
      required: true,
      index: true,
    },
    change: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Change",
      required: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    order: { type: Number, default: 0 },
    presentation: { type: String, default: "" },
    decision: {
      type: String,
      enum: ["pending", "approved", "rejected", "deferred"],
      default: "pending",
    },
    decisionNotes: { type: String, default: "" },
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

cabAgendaItemSchema.index({ meeting: 1, order: 1 });

module.exports = mongoose.model("CABAgendaItem", cabAgendaItemSchema);
