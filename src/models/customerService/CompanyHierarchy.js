const mongoose = require('mongoose');
const companyHierarchySchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  parentCompany: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  childCompanies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Company' }],
  relationship: { type: String, enum: ['parent', 'subsidiary', 'division', 'branch', 'partner'], default: 'parent' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
companyHierarchySchema.index({ company: 1 });
companyHierarchySchema.index({ parentCompany: 1 });
module.exports = mongoose.models.CompanyHierarchy || mongoose.model('CompanyHierarchy', companyHierarchySchema);
