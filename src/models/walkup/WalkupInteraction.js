const { Schema, model } = require("mongoose");
const WalkupInteractionSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    checkinId: {
      type: Schema.Types.ObjectId,
      ref: "WalkupCheckin",
      required: true,
      index: true,
    },
    appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment" },
    locationId: {
      type: Schema.Types.ObjectId,
      ref: "WalkupLocation",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    technicianId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "checkin",
        "consultation",
        "troubleshooting",
        "hardware_swap",
        "software_install",
        "access_request",
        "training",
        "other",
      ],
      default: "consultation",
    },
    subject: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    resolution: { type: String, trim: true, default: "" },
    assetsInvolved: [{ type: Schema.Types.ObjectId, ref: "Asset" }],
    assetsProvided: [
      {
        assetId: { type: Schema.Types.ObjectId, ref: "Asset" },
        serialNumber: { type: String },
        condition: { type: String, enum: ["new", "refurbished", "used"] },
      },
    ],
    softwareInvolved: [{ type: String }],
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    durationMinutes: { type: Number, default: 0 },
    outcome: {
      type: String,
      enum: ["resolved", "escalated", "deferred", "partial", "no_action"],
      default: "resolved",
    },
    satisfactionRating: { type: Number, min: 1, max: 5 },
    satisfactionComment: { type: String, trim: true, default: "" },
    followUpRequired: { type: Boolean, default: false },
    followUpNotes: { type: String, trim: true, default: "" },
    ticketId: { type: Schema.Types.ObjectId, ref: "Ticket" },
    incidentId: { type: Schema.Types.ObjectId, ref: "Incident" },
    requestId: { type: Schema.Types.ObjectId, ref: "Request" },
    changeId: { type: Schema.Types.ObjectId, ref: "Change" },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
WalkupInteractionSchema.index({ tenantId: 1, locationId: 1, createdAt: -1 });
WalkupInteractionSchema.index({ tenantId: 1, checkinId: 1 });
WalkupInteractionSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
WalkupInteractionSchema.index({ tenantId: 1, technicianId: 1, createdAt: -1 });
module.exports = model("WalkupInteraction", WalkupInteractionSchema);
