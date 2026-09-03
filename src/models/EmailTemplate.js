const mongoose = require('mongoose');

const TRIGGERS = [
  { value: 'new_ticket_confirmation', label: 'New ticket created — customer confirmation', recipient: 'user' },
  { value: 'new_ticket_alert', label: 'New ticket created — staff alert', recipient: 'staff' },
  { value: 'new_reply_alert', label: 'Customer replied — staff alert', recipient: 'staff' },
  { value: 'ticket_response', label: 'Staff responded to ticket', recipient: 'user' },
  { value: 'ticket_assigned', label: 'Ticket assigned to agent', recipient: 'agent' },
  { value: 'ticket_resolved', label: 'Ticket resolved — awaiting customer confirmation', recipient: 'user' },
  { value: 'ticket_closed', label: 'Ticket closed', recipient: 'user' },
  { value: 'welcome_user', label: 'Customer account created', recipient: 'user' },
  { value: 'employee_welcome', label: 'Employee account created', recipient: 'user' },
  { value: 'password_reset', label: 'Password reset requested', recipient: 'user' },
  { value: 'admin_welcome', label: 'Company admin account created', recipient: 'admin' },
  { value: 'company_admin_created', label: 'Company registered on platform', recipient: 'admin' },
];

const RECIPIENTS = [
  { value: 'user', label: 'Customer' },
  { value: 'agent', label: 'Assigned Agent' },
  { value: 'staff', label: 'All Staff (department)' },
  { value: 'admin', label: 'Company Admin' },
];

const RECIPIENT_VALUES = RECIPIENTS.map((r) => r.value);

const TRIGGER_VALUES = TRIGGERS.map((t) => t.value);

const emailTemplateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    trigger: { type: String, enum: TRIGGER_VALUES, index: true },
    recipient: { type: String, enum: RECIPIENT_VALUES, default: 'user' },
    isActive: { type: Boolean, default: true },
    context: { type: String, default: 'ticket' },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
  },
  { timestamps: true }
);

emailTemplateSchema.index({ company: 1, key: 1 }, { unique: true });

emailTemplateSchema.statics.getTriggerByKey = (key) =>
  TRIGGERS.find((t) => t.value === key) || { value: key, label: key, recipient: 'user' };

module.exports = mongoose.model('EmailTemplate', emailTemplateSchema);
module.exports.TRIGGERS = TRIGGERS;
module.exports.RECIPIENTS = RECIPIENTS;
