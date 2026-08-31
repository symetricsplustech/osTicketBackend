const mongoose = require('mongoose');
const auditEngagementSchema = new mongoose.Schema({
  name: { type: String, required: true },
  auditType: { type: String, enum: ['internal', 'external', 'compliance', 'supplier'], default: 'internal' },
  scope: String,
  leadAuditor: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  plannedStart: Date,
  plannedEnd: Date,
  findings: [{ refId: String, description: String, severity: String, recommendation: String, owner: String, status: { type: String, enum: ['open', 'remediated', 'validated', 'closed'], default: 'open' }, dueDate: Date }],
  status: { type: String, enum: ['planned', 'fieldwork', 'reporting', 'closed'], default: 'planned' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.AuditEngagement || mongoose.model('AuditEngagement', auditEngagementSchema);
