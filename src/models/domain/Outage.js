const mongoose = require('mongoose');
const outageSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  status: { type: String, enum: ['investigating', 'identified', 'monitoring', 'resolved', 'closed'], default: 'investigating' },
  severity: { type: String, enum: ['minor', 'major', 'critical'], default: 'minor' },
  services: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
  affectedResources: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Resource' }],
  timeline: [{ status: String, message: String, createdAt: { type: Date, default: Date.now }, by: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' } }],
  rootCause: String,
  resolution: String,
  impact: String,
  startedAt: { type: Date, default: Date.now },
  resolvedAt: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
}, { timestamps: true });
module.exports = mongoose.models.Outage || mongoose.model('Outage', outageSchema);
