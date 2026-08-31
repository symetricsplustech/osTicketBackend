const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const threeWayMatchSchema = new mongoose.Schema({
  po: mongoose.Schema.Types.ObjectId, invoice: mongoose.Schema.Types.ObjectId,
  receiptQty: Number, orderedQty: Number, invoiceQty: Number,
  matched: Boolean, variances: [String],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.ThreeWayMatch || mongoose.model('ThreeWayMatch', threeWayMatchSchema);
