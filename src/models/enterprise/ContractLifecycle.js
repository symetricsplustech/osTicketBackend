const mongoose = require('mongoose');
const contractLifecycleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  counterparty: String,
  templateUsed: String,
  clauseLibraryRefs: [String],
  negotiationStatus: { type: String, enum: ['drafting', 'internal_review', 'counterparty_review', 'negotiation', 'final_approval', 'signed'], default: 'drafting' },
  obligations: [{ obligation: String, dueDate: Date, recurring: Boolean, met: Boolean }],
  renewalDate: Date,
  terminationNoticeDays: Number,
  eSignatureRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'SignatureRequest' },
  matter: { type: mongoose.Schema.Types.ObjectId, ref: 'LegalMatter' },
  signedContractUrl: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.ContractLifecycle || mongoose.model('ContractLifecycle', contractLifecycleSchema);
