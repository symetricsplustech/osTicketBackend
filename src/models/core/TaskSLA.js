const mongoose = require("mongoose");

const taskSLASchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true,
    },
    slaPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SlaPlan",
      default: null,
    },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["response", "resolution", "breach"],
      default: "response",
    },
    status: {
      type: String,
      enum: [
        "pending",
        "active",
        "paused",
        "achieved",
        "breached",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },
    startedAt: { type: Date, default: null },
    pausedAt: { type: Date, default: null },
    resumedAt: { type: Date, default: null },
    dueAt: { type: Date, required: true, index: true },
    completedAt: { type: Date, default: null },
    breachedAt: { type: Date, default: null },
    totalPauseDurationMs: { type: Number, default: 0 },
    pauseCount: { type: Number, default: 0 },
    lastPauseStart: { type: Date, default: null },
    businessTimeElapsedMs: { type: Number, default: 0 },
    calendarTimeElapsedMs: { type: Number, default: 0 },
    escalationLevel: { type: Number, default: 0 },
    breached: { type: Boolean, default: false, index: true },
    notificationsSent: { type: [String], default: [] },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

taskSLASchema.index({ tenantId: 1, taskId: 1, type: 1 });
taskSLASchema.index({ tenantId: 1, status: 1, dueAt: 1 });

module.exports = mongoose.model("TaskSLA", taskSLASchema);
