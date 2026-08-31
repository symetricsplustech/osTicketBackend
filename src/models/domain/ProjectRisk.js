const mongoose = require('mongoose');
const projectRiskSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  title: { type: String, required: true },
  description: String,
  probability: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  impact: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  score: { type: Number, default: 0 },
  status: { type: String, enum: ['open', 'mitigated', 'closed', 'accepted'], default: 'open' },
  mitigation: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.ProjectRisk || mongoose.model('ProjectRisk', projectRiskSchema);
