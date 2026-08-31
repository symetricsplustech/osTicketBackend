const mongoose = require('mongoose');
const financeCaseSchema = new mongoose.Schema({
  number: String,
  title: { type: String, required: true },
  caseType: { type: String, enum: ['invoice_exception', 'billing_dispute', 'payment_inquiry', 'ar_collection', 'credit_note', 'write_off', 'journal_request', 'intercompany', 'treasury', 'close_task'], default: 'invoice_exception' },
  relatedInvoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  counterparty: { customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' }, supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' } },
  amount: Number,
  currency: { type: String, default: 'USD' },
  reasonCode: String,
  evidenceUrls: [String],
  approvals: [{ approver: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' }, decision: String, decidedAt: Date }],
  status: { type: String, enum: ['open', 'pending_approval', 'approved', 'rejected', 'resolved'], default: 'open' },
  promiseToPayDate: Date,
  resolvedAt: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.FinanceCase || mongoose.model('FinanceCase', financeCaseSchema);
