const { model } = require("./compat");

module.exports = model("instance_email_inbound_actions", {
  fieldAliases: {
    instanceId: "instance_id",
    channelId: "channel_id",
    name: "name",
    description: "description",
    actionType: "action_type", // create_incident, create_request, update_record, add_comment
    targetRecordType: "target_record_type", // incident, request, change, problem
    targetTable: "target_table",
    conditionScript: "condition_script", // JavaScript condition for matching
    fieldMapping: "field_mapping", // JSON mapping of email fields to record fields
    isActive: "is_active",
    priority: "priority",
    createdBy: "created_by",
    updatedBy: "updated_by",
  },
});