const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const catalogBundleSchema = new mongoose.Schema({
  name: { type: String, required: true }, items: [mongoose.Schema.Types.ObjectId],
  discountPct: { type: Number, default: 0 },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.CatalogBundle || mongoose.model('CatalogBundle', catalogBundleSchema);
