const mongoose = require('mongoose');

const TRIGGER_EVENTS = [
  'ticket.created',
  'ticket.updated',
  'ticket.assigned',
  'ticket.claimed',
  'ticket.transferred',
  'ticket.replied',
  'ticket.status_changed',
  'ticket.priority_changed',
  'ticket.overdue',
  'ticket.escalated',
  'ticket.resolved',
  'ticket.closed',
  'ticket.reopened',
  'customer.replied',
  'approval.completed',
  'inbound.email',
  'schedule.timer',
];

const ACTION_TYPES = [
  'assign_agent',
  'assign_team',
  'transfer_dept',
  'set_priority',
  'set_sla',
  'set_status',
  'add_tags',
  'add_note',
  'create_task',
  'notify_agent',
  'notify_team',
  'notify_dept_manager',
  'notify_customer',
  'send_email',
  'send_webhook',
  'start_approval',
  'pause_sla',
  'resume_sla',
  'escalate',
  'create_incident',
  'link_asset',
  'call_api',
];

const conditionSchema = new mongoose.Schema(
  {
    field: {
      type: String,
      enum: [
        'priority',
        'status',
        'dept',
        'topic',
        'source',
        'customer_tier',
        'organization',
        'entitlement',
        'sentiment',
        'language',
        'subject',
        'waiting_on',
        'is_overdue',
        'custom_data',
      ],
      required: true,
    },
    operator: {
      type: String,
      enum: ['equals', 'not_equals', 'contains', 'in', 'not_in', 'exists', 'greater_than', 'less_than'],
      default: 'equals',
    },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const actionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ACTION_TYPES, required: true },
    // polymorphic payload per action type
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    delayMinutes: { type: Number, default: 0 },
  },
  { _id: false }
);

const workflowSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    event: { type: String, enum: TRIGGER_EVENTS, required: true },
    triggerFilters: { type: mongoose.Schema.Types.Mixed, default: {} },
    conditions: { type: [conditionSchema], default: [] },
    actions: { type: [actionSchema], default: [] },
    runCount: { type: Number, default: 0 },
    lastRunAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
  },
  { timestamps: true }
);

workflowSchema.index({ company: 1, event: 1, isActive: 1 });
workflowSchema.statics.EVENTS = TRIGGER_EVENTS;
workflowSchema.statics.ACTIONS = ACTION_TYPES;

module.exports = mongoose.model('Workflow', workflowSchema);