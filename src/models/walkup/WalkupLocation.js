const { Schema, model } = require("mongoose");
const WalkupLocationSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    number: { type: String, required: true, unique: true },
    address: { type: String, trim: true, default: "" },
    floor: { type: String, trim: true, default: "" },
    room: { type: String, trim: true, default: "" },
    timezone: { type: String, required: true, default: "UTC" },
    hours: {
      monday: {
        open: { type: String, default: "08:00" },
        close: { type: String, default: "17:00" },
        closed: { type: Boolean, default: false },
      },
      tuesday: {
        open: { type: String, default: "08:00" },
        close: { type: String, default: "17:00" },
        closed: { type: Boolean, default: false },
      },
      wednesday: {
        open: { type: String, default: "08:00" },
        close: { type: String, default: "17:00" },
        closed: { type: Boolean, default: false },
      },
      thursday: {
        open: { type: String, default: "08:00" },
        close: { type: String, default: "17:00" },
        closed: { type: Boolean, default: false },
      },
      friday: {
        open: { type: String, default: "08:00" },
        close: { type: String, default: "17:00" },
        closed: { type: Boolean, default: false },
      },
      saturday: {
        open: { type: String, default: "09:00" },
        close: { type: String, default: "15:00" },
        closed: { type: Boolean, default: true },
      },
      sunday: {
        open: { type: String, default: "09:00" },
        close: { type: String, default: "15:00" },
        closed: { type: Boolean, default: true },
      },
    },
    exceptions: [
      {
        date: { type: Date, required: true },
        open: { type: String },
        close: { type: String },
        closed: { type: Boolean, default: true },
        reason: { type: String },
      },
    ],
    services: [{ type: Schema.Types.ObjectId, ref: "WalkupService" }],
    kiosks: [{ type: Schema.Types.ObjectId, ref: "Kiosk" }],
    team: { type: Schema.Types.ObjectId, ref: "Team" },
    maxConcurrentCheckins: { type: Number, default: 10 },
    waitTimeEstimation: { type: Boolean, default: true },
    autoAssign: { type: Boolean, default: true },
    checkinMethods: [
      {
        type: String,
        enum: ["kiosk", "mobile", "desk", "qr"],
        default: ["kiosk", "mobile", "desk"],
      },
    ],
    status: {
      type: String,
      enum: ["active", "inactive", "maintenance"],
      default: "active",
      index: true,
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
WalkupLocationSchema.index({ tenantId: 1, status: 1, isDeleted: 1 });
WalkupLocationSchema.index({ tenantId: 1, team: 1 });
module.exports = model("WalkupLocation", WalkupLocationSchema);
