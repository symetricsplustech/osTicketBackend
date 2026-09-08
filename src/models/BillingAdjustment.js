const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
  type: { type: String, enum: ['tax', 'coupon', 'credit', 'refund', 'writeoff'], required: true },
  code: { type: String, default: '' },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  reason: { type: String, required: true },
  status: { type: String, enum: ['pending', 'applied', 'reversed'], default: 'applied' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin', required: true },
}, { timestamps: true });
module.exports = mongoose.model('BillingAdjustment', schema);
