const { model } = require("./compat");

module.exports = model("instance_email_senders", {
  fieldAliases: {
    instanceId: "instance_id",
    channelId: "channel_id",
    name: "name",
    fromName: "from_name",
    fromEmail: "from_email",
    replyToEmail: "reply_to_email",
    isDefault: "is_default",
    dkimSigned: "dkim_signed",
    createdBy: "created_by",
    updatedBy: "updated_by",
  },
});