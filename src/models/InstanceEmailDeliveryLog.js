const { model } = require("./compat");

module.exports = model("instance_email_delivery_logs", {
  fieldAliases: {
    instanceId: "instance_id",
    channelId: "channel_id",
    senderId: "sender_id",
    messageId: "message_id",
    direction: "direction", // inbound, outbound
    status: "status", // sent, delivered, failed, bounced, spam
    fromEmail: "from_email",
    toEmail: "to_email",
    subject: "subject",
    bodyPreview: "body_preview",
    errorMessage: "error_message",
    rawHeaders: "raw_headers",
    rawBody: "raw_body",
    processedAt: "processed_at",
    deliveredAt: "delivered_at",
    failedAt: "failed_at",
  },
});