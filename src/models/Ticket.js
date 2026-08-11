const mongoose = require('mongoose');

const STATUSES = {
  OPEN: 'open',
  ASSIGNED: 'assigned',
  OVERDUE: 'overdue',
  CLOSED: 'closed',
  ARCHIVED: 'archived',
  DELETED: 'deleted',
};

const ticketSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    dept: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'HelpTopic', default: null },
    status: { type: String, enum: Object.values(STATUSES), default: STATUSES.OPEN, index: true },
    priority: {
      type: String,
      enum: ['Low', 'Normal', 'High', 'Emergency'],
      default: 'Normal',
      index: true,
    },
    sla: { type: mongoose.Schema.Types.ObjectId, ref: 'SlaPlan', default: null },
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null, index: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    subject: { type: String, required: true, trim: true, index: true },
    source: {
      type: String,
      enum: ['web', 'email', 'phone', 'api'],
      default: 'web',
    },
    dueDate: { type: Date, default: null },
    isOverdue: { type: Boolean, default: false },
    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    lockedAt: { type: Date, default: null },
    lockExpiresAt: { type: Date, default: null },
    lastActivity: { type: Date, default: Date.now },
    closedAt: { type: Date, default: null },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    lastMessageAt: { type: Date, default: null },
    customData: { type: mongoose.Schema.Types.Mixed, default: {} },
    stats: {
      responses: { type: Number, default: 0 },
      messages: { type: Number, default: 0 },
      firstResponseAt: { type: Date, default: null },
      reopened: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

ticketSchema.index({ status: 1, updatedAt: -1 });
ticketSchema.index({ dept: 1, status: 1 });

ticketSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model('Ticket', ticketSchema);
