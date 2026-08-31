const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const catalogEligibilitySchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCatalogItem', required: true },
  departments: [String], locations: [String],
  maxPerUserPerMonth: { type: Number, default: 0 },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.CatalogEligibility || mongoose.model('CatalogEligibility', catalogEligibilitySchema);
