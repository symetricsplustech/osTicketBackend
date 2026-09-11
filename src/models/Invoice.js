const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', default: null },
  number: { type: String, trim: true, default: '' },
  amount: { type: Number, default: 0 },
  currency: { type: String, default: 'INR' },
  status: { type: String, default: 'pending' },
  dueDate: { type: Date, default: null },
  paidAt: { type: Date, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
