const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, default: '' },
    severity: { type: String, enum: ['info', 'warning', 'critical', 'emergency'], default: 'warning' },
    status: { type: String, enum: ['firing', 'acknowledged', 'resolved', 'silenced'], default: 'firing' },
    source: { type: String, default: 'manual' },
    resource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', default: null },
    service: { type: String, default: '' },
    metric: { type: String, default: '' },
    threshold: { type: Number, default: 0 },
    currentValue: { type: Number, default: 0 },
    incident: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', default: null },
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', default: null },
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    acknowledgedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    silencedUntil: { type: Date, default: null },
    tags: { type: [String], default: [] },
    labels: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
  },
  { timestamps: true }
);

alertSchema.index({ company: 1, status: 1 });
alertSchema.index({ company: 1, severity: 1 });
alertSchema.index({ company: 1, resource: 1 });

module.exports = mongoose.model('Alert', alertSchema);
