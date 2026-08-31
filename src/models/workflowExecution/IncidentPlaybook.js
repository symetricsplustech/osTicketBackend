const mongoose = require('mongoose');
const incidentPlaybookSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  description: String,
  category: { type: String, enum: ['network', 'server', 'application', 'database', 'security', 'other'], default: 'other' },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  steps: [{
    order: Number,
    title: String,
    description: String,
    assignedRole: String,
    estimatedMinutes: Number,
    checklist: [String],
    escalationMinutes: Number,
    escalationContact: String,
  }],
  estimatedMinutes: Number,
  status: { type: String, enum: ['active', 'draft', 'archived'], default: 'draft' },
  lastUsedAt: Date,
  useCount: { type: Number, default: 0 },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
}, { timestamps: true });
incidentPlaybookSchema.index({ category: 1, severity: 1 });
module.exports = mongoose.models.IncidentPlaybook || mongoose.model('IncidentPlaybook', incidentPlaybookSchema);
