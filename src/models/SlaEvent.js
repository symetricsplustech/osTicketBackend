const mongoose = require('mongoose');

const slaEventSchema = new mongoose.Schema({
  level: { type: String, enum: ['platform', 'tenant'], required: true, index: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
  ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', default: null, index: true },
  policy: { type: mongoose.Schema.Types.ObjectId, refPath: 'policyModel', default: null },
  policyModel: { type: String, enum: ['SlaPlan', 'PlatformSlaPolicy'], default: 'SlaPlan' },
  service: { type: String, required: true, index: true },
  clock: { type: String, default: '' },
  event: { type: String, enum: ['started', 'warning', 'paused', 'resumed', 'met', 'breached', 'stopped', 'measurement'], required: true, index: true },
  priority: { type: String, default: '' },
  occurredAt: { type: Date, default: Date.now, index: true },
  startedAt: Date,
  dueAt: Date,
  completedAt: Date,
  pausedDurationMs: { type: Number, default: 0 },
  durationMs: { type: Number, default: null },
  target: { type: Number, default: null },
  actual: { type: Number, default: null },
  unit: { type: String, default: '' },
  reason: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  actorType: { type: String, default: 'system' },
  actor: { type: mongoose.Schema.Types.ObjectId, default: null },
}, { timestamps: true });

slaEventSchema.index({ level: 1, company: 1, occurredAt: -1 });
slaEventSchema.index({ ticket: 1, occurredAt: 1 });
module.exports = mongoose.model('SlaEvent', slaEventSchema);
