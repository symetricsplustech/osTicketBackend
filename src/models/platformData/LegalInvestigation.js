const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const legalInvestigationSchema = new mongoose.Schema({
  matter: { type: mongoose.Schema.Types.ObjectId, ref: 'LegalMatter', index: true },
  allegations: [String], interviews: [{ person: String, summary: String }],
  evidence: [String], findings: String, privileged: { type: Boolean, default: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.LegalInvestigation || mongoose.model('LegalInvestigation', legalInvestigationSchema);
