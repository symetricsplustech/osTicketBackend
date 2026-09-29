const { model } = require("./compat");

const InstanceEmailChannel = model("instance_email_channels", {
  fieldAliases: {
    instanceId: "instance_id",
    inboundAddress: "inbound_address",
    inboundDomain: "inbound_domain",
    verificationToken: "verification_token",
    verificationMethod: "verification_method",
    smtpHost: "smtp_host",
    smtpPort: "smtp_port",
    smtpSecure: "smtp_secure",
    smtpUsername: "smtp_username",
    smtpPassword: "smtp_password",
    fromAddress: "from_address",
    fromName: "from_name",
    replyToAddress: "reply_to_address",
    spfRecord: "spf_record",
    dkimPrivateKey: "dkim_private_key",
    dkimSelector: "dkim_selector",
    dmarcRecord: "dmarc_record",
    spfVerified: "spf_verified",
    dkimVerified: "dkim_verified",
    dmarcVerified: "dmarc_verified",
    verifiedAt: "verified_at",
    verifiedBy: "verified_by",
    activatedAt: "activated_at",
    activatedBy: "activated_by",
    disabledAt: "disabled_at",
    disabledBy: "disabled_by",
    failureReason: "failure_reason",
  },
  instanceMethods: {
    isActive() {
      return this.status === "active";
    },
    isVerified() {
      return this.status === "verified" || this.status === "active";
    },
  },
});

const InstanceEmailInboundAction = model("instance_email_inbound_actions", {
  fieldAliases: {
    channelId: "channel_id",
    actionType: "action_type",
    actionConfig: "action_config",
    isActive: "is_active",
  },
  jsonColumns: ["action_config", "conditions"],
});

const InstanceEmailSenderConfig = model("instance_email_sender_configs", {
  fieldAliases: {
    channelId: "channel_id",
    fromAddress: "from_address",
    fromName: "from_name",
    replyToAddress: "reply_to_address",
    isDefault: "is_default",
  },
  jsonColumns: ["headers"],
});

const InstanceEmailDeliveryLog = model("instance_email_delivery_logs", {
  fieldAliases: {
    channelId: "channel_id",
    senderConfigId: "sender_config_id",
    toAddress: "to_address",
    fromAddress: "from_address",
    messageId: "message_id",
    sentAt: "sent_at",
    deliveredAt: "delivered_at",
    bouncedAt: "bounced_at",
    complainedAt: "complained_at",
  },
});

const InstanceEmailMessageAudit = model("instance_email_message_audit", {
  fieldAliases: {
    channelId: "channel_id",
    messageId: "message_id",
    inReplyTo: "in_reply_to",
    fromAddress: "from_address",
    toAddresses: "to_addresses",
    ccAddresses: "cc_addresses",
    recordId: "record_id",
    recordType: "record_type",
    errorMessage: "error_message",
    processedAt: "processed_at",
  },
});

module.exports = {
  InstanceEmailChannel,
  InstanceEmailInboundAction,
  InstanceEmailSenderConfig,
  InstanceEmailDeliveryLog,
  InstanceEmailMessageAudit,
};
