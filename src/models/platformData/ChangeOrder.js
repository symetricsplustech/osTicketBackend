const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const changeOrderSchema = new mongoose.Schema({
  po: { type: mongoose.Schema.Types.ObjectId, ref: 'Procurement', required: true },
  deltaLines: [{ description: String, quantityDelta: Number, unitPrice: Number }],
  reason: String, approvedBy: oid,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.ChangeOrder || mongoose.model('ChangeOrder', changeOrderSchema);
