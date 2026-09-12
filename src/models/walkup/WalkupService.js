const { Schema, model } = require("mongoose");
const WalkupServiceSchema = new Schema(
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
    category: {
      type: String,
      enum: [
        "hardware",
        "software",
        "access",
        "account",
        "network",
        "printer",
        "phone",
        "other",
      ],
      default: "other",
      index: true,
    },
    locations: [{ type: Schema.Types.ObjectId, ref: "WalkupLocation" }],
    estimatedDuration: { type: Number, default: 15 }, // minutes
    requiresAppointment: { type: Boolean, default: false },
    allowsWalkin: { type: Boolean, default: true },
    requiresApproval: { type: Boolean, default: false },
    requiresAsset: { type: Boolean, default: false },
    skillRequired: { type: Schema.Types.ObjectId, ref: "Skill" },
    slaTargetMinutes: { type: Number, default: 30 },
    autoCreateTicket: { type: Boolean, default: true },
    ticketTemplate: { type: Schema.Types.ObjectId, ref: "TicketTemplate" },
    status: {
      type: String,
      enum: ["active", "inactive"],
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
WalkupServiceSchema.index({ tenantId: 1, status: 1, isDeleted: 1 });
module.exports = model("WalkupService", WalkupServiceSchema);
