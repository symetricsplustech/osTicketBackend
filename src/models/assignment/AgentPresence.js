const { Schema, model } = require("mongoose");
const AgentPresenceSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    agentId: {
      type: Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        "available",
        "busy",
        "away",
        "offline",
        "on_break",
        "in_meeting",
        "dnd",
      ],
      required: true,
      index: true,
    },
    previousStatus: { type: String },
    reason: { type: String, trim: true, default: "" },
    ticketNumber: { type: String },
    since: { type: Date, default: Date.now },
    until: { type: Date },
    expectedReturn: { type: Date },
    isManual: { type: Boolean, default: false },
    source: {
      type: String,
      enum: ["system", "manual", "schedule", "heartbeat"],
      default: "manual",
    },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);
AgentPresenceSchema.index({ tenantId: 1, agentId: 1, createdAt: -1 });
module.exports = model("AgentPresence", AgentPresenceSchema);
