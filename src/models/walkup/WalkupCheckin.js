const { Schema, model } = require("mongoose");
const WalkupCheckinSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    locationId: {
      type: Schema.Types.ObjectId,
      ref: "WalkupLocation",
      required: true,
      index: true,
    },
    queueId: {
      type: Schema.Types.ObjectId,
      ref: "WalkupQueue",
      required: true,
      index: true,
    },
    serviceId: { type: Schema.Types.ObjectId, ref: "WalkupService" },
    appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment" },
    kioskId: { type: Schema.Types.ObjectId, ref: "Kiosk" },
    number: { type: String, required: true, unique: true },
    queueNumber: { type: Number },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userName: { type: String, required: true, trim: true },
    userEmail: { type: String, trim: true, default: "" },
    userPhone: { type: String, trim: true, default: "" },
    checkinMethod: {
      type: String,
      enum: ["kiosk", "mobile", "desk", "qr", "appointment"],
      required: true,
    },
    status: {
      type: String,
      enum: [
        "waiting",
        "called",
        "in_service",
        "completed",
        "no_show",
        "cancelled",
      ],
      default: "waiting",
      index: true,
    },
    priority: { type: Number, default: 0 },
    reason: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    checkinAt: { type: Date, default: Date.now, index: true },
    calledAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    waitMinutes: { type: Number, default: 0 },
    serviceMinutes: { type: Number, default: 0 },
    technicianId: { type: Schema.Types.ObjectId, ref: "User" },
    technicianName: { type: String, trim: true, default: "" },
    satisfactionRating: { type: Number, min: 1, max: 5 },
    satisfactionComment: { type: String, trim: true, default: "" },
    outcome: {
      type: String,
      enum: ["resolved", "escalated", "deferred", "no_show", "cancelled"],
      default: "resolved",
    },
    ticketId: { type: Schema.Types.ObjectId, ref: "Ticket" },
    incidentId: { type: Schema.Types.ObjectId, ref: "Incident" },
    requestId: { type: Schema.Types.ObjectId, ref: "Request" },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
WalkupCheckinSchema.index({
  tenantId: 1,
  locationId: 1,
  status: 1,
  checkinAt: -1,
});
WalkupCheckinSchema.index({ tenantId: 1, userId: 1, checkinAt: -1 });
WalkupCheckinSchema.index({ queueId: 1, status: 1, queueNumber: 1 });
module.exports = model("WalkupCheckin", WalkupCheckinSchema);
