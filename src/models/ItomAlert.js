const mongoose = require("mongoose");

const itomAlertSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    severity: {
      type: String,
      enum: ["critical", "major", "minor", "info"],
      default: "major",
    },
    status: {
      type: String,
      enum: ["firing", "acknowledged", "resolved"],
      default: "firing",
    },
    source: { type: String, default: "" },
    resource: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Asset",
      default: null,
    },
    count: { type: Number, default: 1 },
    firedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

itomAlertSchema.index({ company: 1, status: 1, severity: 1 });

module.exports = mongoose.model("ItomAlert", itomAlertSchema);