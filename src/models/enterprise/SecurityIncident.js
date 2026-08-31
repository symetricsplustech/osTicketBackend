const mongoose = require('mongoose');
const securityIncidentSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  category: { type: String, enum: ['phishing', 'malware', 'data_loss', 'account_takeover', 'unauthorized_access', 'insider_threat', 'ddos', 'other'], default: 'other' },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  riskScore: { type: Number, default: 0 },
  status: { type: String, enum: ['new', 'triage', 'investigating', 'contained', 'eradicated', 'recovered', 'closed'], default: 'new' },
  assignedAnalyst: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  mitreTactics: [String],
  affectedAssets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CI' }],
  indicators: [{ type: { type: String, enum: ['ip', 'domain', 'url', 'hash', 'email'] }, value: String, reputation: String }],
  evidence: [{ filename: String, url: String, chainOfCustody: String }],
  containmentActions: [{ action: String, executedAt: Date, by: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' }, result: String }],
  timeline: [{ at: Date, entry: String, by: String }],
  breachAssessment: { isBreach: Boolean, notifiedRegulator: Boolean, notifiedDataSubjects: Boolean, assessedAt: Date },
  playbook: { type: mongoose.Schema.Types.ObjectId, ref: 'IncidentPlaybook' },
  closedAt: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.SecurityIncident || mongoose.model('SecurityIncident', securityIncidentSchema);
