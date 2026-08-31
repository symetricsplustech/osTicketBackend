const mongoose = require('mongoose');
const soarPlaybookSchema = new mongoose.Schema({
  name: { type: String, required: true },
  triggerCategory: { type: String, enum: ['phishing', 'malware', 'data_loss', 'account_takeover', 'any'], default: 'phishing' },
  steps: [{ seq: Number, kind: { type: String, enum: ['containment', 'notify', 'create_ticket', 'add_indicator'] }, params: mongoose.Schema.Types.Mixed }],
  enabled: { type: Boolean, default: true },
  runs: [{ incident: mongoose.Schema.Types.ObjectId, executedSteps: [String], ranAt: Date }],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.SoarPlaybook || mongoose.model('SoarPlaybook', soarPlaybookSchema);
