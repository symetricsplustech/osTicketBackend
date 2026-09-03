const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema(
  {
    to: { type: String, required: true },
    from: { type: String, default: '' },
    subject: { type: String, default: '' },
    body: { type: String, default: '' },
    event: { type: String, default: 'general' },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', default: null },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: ['sent', 'queued', 'failed', 'processed'], default: 'queued' },
    error: { type: String, default: '' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

emailLogSchema.index({ 'meta.messageId': 1 }, { sparse: true });

module.exports = mongoose.model('EmailLog', emailLogSchema);
