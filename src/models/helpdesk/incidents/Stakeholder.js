const { Schema, model } = require("mongoose");
const StakeholderSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    majorIncidentId: {
      type: Schema.Types.ObjectId,
      ref: "MajorIncident",
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    email: { type: String, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: [
        "executive",
        "customer",
        "vendor",
        "partner",
        "regulator",
        "internal",
        "media",
        "other",
      ],
      default: "internal",
    },
    communicationPreference: {
      type: String,
      enum: ["email", "sms", "slack", "teams", "webhook", "all"],
      default: "email",
    },
    notificationCadence: {
      type: String,
      enum: ["realtime", "every_15m", "every_30m", "hourly", "on_change"],
      default: "on_change",
    },
    lastNotifiedAt: { type: Date },
    isActive: { type: Boolean, default: true },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);
StakeholderSchema.index({ tenantId: 1, majorIncidentId: 1, isActive: 1 });
module.exports = model("Stakeholder", StakeholderSchema);
