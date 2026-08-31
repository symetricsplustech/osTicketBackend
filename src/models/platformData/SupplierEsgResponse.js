const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const supplierEsgResponseSchema = new mongoose.Schema({
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  template: mongoose.Schema.Types.ObjectId,
  answers: [{ question: String, answer: String, scorePct: Number }],
  totalScorePct: Number,
  emissionsKgCO2e: Number,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.SupplierEsgResponse || mongoose.model('SupplierEsgResponse', supplierEsgResponseSchema);
