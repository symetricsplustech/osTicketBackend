const mongoose = require('mongoose');
const taxRuleSchema = new mongoose.Schema({
  region: { type: String, required: true }, taxPct: Number, shippingFlat: Number,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.TaxRule || mongoose.model('TaxRule', taxRuleSchema);
