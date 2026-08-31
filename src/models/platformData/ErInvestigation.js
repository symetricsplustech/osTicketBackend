const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const erInvestigationSchema = new mongoose.Schema({
  subjectEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  allegations: [{ statement: String, reportedBy: String, date: Date }],
  interviews: [{ person: String, notes: String, at: Date }],
  evidenceRefs: [String], findings: String,
  status: { type: String, enum: ['open', 'findings', 'closed'], default: 'open' },
  restrictedTo: [oid],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.ErInvestigation || mongoose.model('ErInvestigation', erInvestigationSchema);
