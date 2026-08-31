const mongoose = require('mongoose');
const hrRequestCatalogueSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  description: String,
  category: { type: String, enum: ['leave', 'payroll', 'benefits', 'training', 'documents', 'onboarding', 'other'], required: true },
  fields: [{ name: String, type: String, required: Boolean, options: [String] }],
  approvalRequired: { type: Boolean, default: true },
  approverRole: String,
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.HrRequestCatalogue || mongoose.model('HrRequestCatalogue', hrRequestCatalogueSchema);
