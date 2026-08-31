const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const docTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, enum: ['employment_letter', 'salary_certificate', 'experience_letter', 'noc', 'contract_addendum', 'other'], default: 'other' },
  body: { type: String, required: true },
  requiresSignature: Boolean,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.DocTemplate || mongoose.model('DocTemplate', docTemplateSchema);
