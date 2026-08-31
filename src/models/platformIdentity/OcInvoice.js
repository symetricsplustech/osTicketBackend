const mongoose = require('mongoose');
const ocInvoiceSchema = new mongoose.Schema({
  matter: { type: mongoose.Schema.Types.ObjectId, ref: 'LegalMatter', required: true },
  firm: String, amount: Number, period: String,
  status: { type: String, enum: ['submitted', 'reviewed', 'approved', 'queried'], default: 'submitted' },
  reviewedBy: mongoose.Schema.Types.ObjectId, notes: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.OcInvoice || mongoose.model('OcInvoice', ocInvoiceSchema);
