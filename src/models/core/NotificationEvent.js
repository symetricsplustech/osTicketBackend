const mongoose = require("mongoose");

const notificationEventSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    eventType: { type: String, required: true, index: true },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
      index: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ["email", "in_app", "push", "sms"],
      default: "in_app",
    },
    subject: { type: String, default: "" },
    body: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "sent", "failed", "read"],
      default: "pending",
      index: true,
    },
    sentAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    retryCount: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 3 },
    correlationId: { type: String, default: null },
  },
  { timestamps: true },
);

notificationEventSchema.index({ tenantId: 1, recipientId: 1, status: 1 });
notificationEventSchema.index({ tenantId: 1, taskId: 1, eventType: 1 });

module.exports = mongoose.model("NotificationEvent", notificationEventSchema);
