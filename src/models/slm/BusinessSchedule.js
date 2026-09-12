const { Schema, model } = require("mongoose");
const BusinessScheduleSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    number: { type: String, required: true, unique: true },
    description: { type: String, trim: true, default: "" },
    type: {
      type: String,
      enum: ["24/7", "business_hours", "custom"],
      default: "business_hours",
    },
    timezone: { type: String, default: "UTC" },
    businessHours: {
      monday: {
        enabled: { type: Boolean, default: true },
        start: { type: String, default: "09:00" },
        end: { type: String, default: "17:00" },
      },
      tuesday: {
        enabled: { type: Boolean, default: true },
        start: { type: String, default: "09:00" },
        end: { type: String, default: "17:00" },
      },
      wednesday: {
        enabled: { type: Boolean, default: true },
        start: { type: String, default: "09:00" },
        end: { type: String, default: "17:00" },
      },
      thursday: {
        enabled: { type: Boolean, default: true },
        start: { type: String, default: "09:00" },
        end: { type: String, default: "17:00" },
      },
      friday: {
        enabled: { type: Boolean, default: true },
        start: { type: String, default: "09:00" },
        end: { type: String, default: "17:00" },
      },
      saturday: {
        enabled: { type: Boolean, default: false },
        start: { type: String, default: "09:00" },
        end: { type: String, default: "17:00" },
      },
      sunday: {
        enabled: { type: Boolean, default: false },
        start: { type: String, default: "09:00" },
        end: { type: String, default: "17:00" },
      },
    },
    holidays: [{ type: Schema.Types.ObjectId, ref: "Holiday" }],
    isActive: { type: Boolean, default: true, index: true },
    isDefault: { type: Boolean, default: false },
    slaPlanCount: { type: Number, default: 0 },
    meta: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
BusinessScheduleSchema.index({ tenantId: 1, isActive: 1, isDeleted: 1 });
module.exports = model("BusinessSchedule", BusinessScheduleSchema);
