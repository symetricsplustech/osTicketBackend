const mongoose = require('mongoose');

const callLogSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    callId: { type: String, default: '' },
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', default: null },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    callerName: { type: String, default: '' },
    callerNumber: { type: String, default: '' },
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    direction: { type: String, enum: ['inbound', 'outbound'], default: 'inbound' },
    status: {
      type: String,
      enum: ['ringing', 'in_progress', 'completed', 'missed', 'failed', 'cancelled'],
      default: 'completed',
    },
    startedAt: { type: Date, default: Date.now },
    answeredAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    durationSec: { type: Number, default: 0 },
    recordingUrl: { type: String, default: '' },
    transcription: { type: String, default: '' },
    aiSummary: { type: String, default: '' },
    intent: { type: String, default: '' },
    sentiment: { type: String, default: '' },
    callbackScheduled: { type: Date, default: null },
    ivrPath: { type: String, default: '' },
    queue: { type: String, default: '' },
    holdSeconds: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

callLogSchema.index({ company: 1, startedAt: -1 });
callLogSchema.index({ company: 1, status: 1 });

module.exports = mongoose.model('CallLog', callLogSchema);