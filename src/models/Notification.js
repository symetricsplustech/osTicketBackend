const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      default: null,
      index: true,
      set: (v) => (v && v !== 'undefined' && v !== 'null' ? v : null),
    },
    recipientType: { type: String, enum: ['agent', 'user', 'superadmin'], required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    type: {
      type: String,
      enum: [
        'new_ticket',
        'reply',
        'assignment',
        'transfer',
        'overdue',
        'system',
        'status_change',
        'company_created',
        'company_updated',
        'company_status_changed',
        'company_plan_changed',
        'company_deleted',
        'payment_received',
        'invoice_paid',
        'trial_ending',
        'plan_created',
        'plan_updated',
        'account_created',
        'mention',
        'sla_paused',
        'sla_resumed',
        'merged',
        'split',
      ],
      default: 'system',
    },
    message: { type: String, required: true },
    link: { type: String, default: '' },
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
