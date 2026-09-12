const mongoose = require("mongoose");

const majorIncidentSchema = new mongoose.Schema(
  {
    incident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Incident",
      required: true,
      index: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ["candidate", "declared", "rejected", "demoted"],
      default: "candidate",
      index: true,
    },
    declaredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    declaredAt: { type: Date, default: null },
    commander: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    majorType: {
      type: String,
      enum: ["outage", "degradation", "security", "data_breach", "other"],
      default: "outage",
    },
    communicationPlan: {
      internal: { type: String, default: "" },
      external: { type: String, default: "" },
      cadenceMinutes: { type: Number, default: 30 },
      lastBroadcastAt: { type: Date, default: null },
    },
    execSummary: { type: String, default: "" },
    impactedServices: [{ type: String, default: "" }],
    estimatedImpact: { type: String, default: "" },
    warRoomUrl: { type: String, default: "" },
    resolvedAt: { type: Date, default: null },
    demotedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    demotedAt: { type: Date, default: null },
    demotionReason: { type: String, default: "" },
  },
  { timestamps: true },
);

majorIncidentSchema.index({ company: 1, status: 1 });
majorIncidentSchema.index({ incident: 1 }, { unique: true });

module.exports = mongoose.model("MajorIncident", majorIncidentSchema);
