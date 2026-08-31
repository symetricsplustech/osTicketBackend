const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const recordAccessRuleSchema = new mongoose.Schema({
  resourceType: { type: String, enum: ['ticket', 'asset', 'lead', 'hr_case', 'finance_case'], required: true },
  condition: { field: String, operator: { type: String, enum: ['equals', 'not_equals', 'in', 'contains'] }, value: String },
  rolesAllowed: [String],
  effect: { type: String, enum: ['allow', 'deny'], default: 'allow' },
  priority: { type: Number, default: 100 },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.RecordAccessRule || mongoose.model('RecordAccessRule', recordAccessRuleSchema);
