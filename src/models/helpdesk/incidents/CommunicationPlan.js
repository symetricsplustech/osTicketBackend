const { Schema, model } = require("mongoose");
const CommunicationPlanSchema = new Schema(
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
    internal: {
      enabled: { type: Boolean, default: true },
      cadenceMinutes: { type: Number, default: 30 },
      channels: [{ type: String }],
    },
    external: {
      enabled: { type: Boolean, default: true },
      cadenceMinutes: { type: Number, default: 60 },
      channels: [{ type: String }],
    },
    stakeholder: {
      enabled: { type: Boolean, default: true },
      cadenceMinutes: { type: Number, default: 60 },
    },
    executive: {
      enabled: { type: Boolean, default: true },
      cadenceMinutes: { type: Number, default: 120 },
    },
    autoBroadcast: { type: Boolean, default: false },
    nextInternalAt: { type: Date },
    nextExternalAt: { type: Date },
    nextStakeholderAt: { type: Date },
    nextExecutiveAt: { type: Date },
    lastInternalAt: { type: Date },
    lastExternalAt: { type: Date },
    lastStakeholderAt: { type: Date },
    lastExecutiveAt: { type: Date },
    messageTemplate: { type: String, default: "" },
  },
  { timestamps: true },
);
CommunicationPlanSchema.index({ tenantId: 1, majorIncidentId: 1 });
module.exports = model("CommunicationPlan", CommunicationPlanSchema);
