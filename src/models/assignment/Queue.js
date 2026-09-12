const { Schema, model } = require("mongoose");
const QueueSchema = new Schema(
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
    type: {
      type: String,
      enum: ["advanced", "service", "contextual"],
      default: "advanced",
    },
    isActive: { type: Boolean, default: true, index: true },
    isDefault: { type: Boolean, default: false },
    department: { type: Schema.Types.ObjectId, ref: "Department" },
    service: { type: Schema.Types.ObjectId, ref: "Service" },
    topic: { type: String },
    conditions: {
      matchAll: { type: Boolean, default: true },
      rules: [
        {
          field: { type: String, required: true },
          operator: {
            type: String,
            required: true,
            enum: [
              "equals",
              "not_equals",
              "in",
              "not_in",
              "contains",
              "gt",
              "lt",
              "gte",
              "lte",
            ],
          },
          value: { type: Schema.Types.Mixed },
        },
      ],
    },
    members: {
      groups: [{ type: Schema.Types.ObjectId, ref: "Team" }],
      agents: [{ type: Schema.Types.ObjectId, ref: "Agent" }],
    },
    routingStrategy: {
      type: String,
      enum: [
        "round_robin",
        "least_workload",
        "skill_based",
        "availability",
        "random",
        "manual",
      ],
      default: "round_robin",
    },
    overflowAction: {
      type: String,
      enum: ["none", "escalate", "reassign", "notify"],
      default: "none",
    },
    overflowAfterMinutes: { type: Number, default: 0 },
    ticketCount: { type: Number, default: 0 },
    openCount: { type: Number, default: 0 },
    backlogCount: { type: Number, default: 0 },
    slaBreachedCount: { type: Number, default: 0 },
    averageWaitMinutes: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
    meta: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
QueueSchema.index({ tenantId: 1, isActive: 1, isDeleted: 1 });
module.exports = model("Queue", QueueSchema);
