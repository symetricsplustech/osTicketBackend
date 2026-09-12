const mongoose = require("mongoose");

const incidentCISchema = new mongoose.Schema(
  {
    incident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Incident",
      required: true,
      index: true,
    },
    ci: { type: mongoose.Schema.Types.ObjectId, ref: "CI", required: true },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    linkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    linkedAt: { type: Date, default: Date.now },
    role: {
      type: String,
      enum: ["primary", "affected", "related"],
      default: "affected",
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

incidentCISchema.index({ incident: 1, ci: 1 }, { unique: true });
incidentCISchema.index({ company: 1, incident: 1 });

module.exports = mongoose.model("IncidentCI", incidentCISchema);
