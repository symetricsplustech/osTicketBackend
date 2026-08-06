const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema(
  {
    to: { type: String, required: true },
    from: { type: String, default: '' },
    subject: { type: String, default: '' },
    body: { type: String, default: '' },
    event: { type: String, default: 'general' },
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', default: null },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: ['sent', 'queued', 'failed'], default: 'queued' },
    error: { type: String, default: '' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EmailLog', emailLogSchema);
