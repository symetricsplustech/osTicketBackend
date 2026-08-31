const mongoose = require('mongoose');
const signatureRequestSchema = new mongoose.Schema({
  entityType: { type: String, enum: ['quote', 'contract', 'work_order'], default: 'quote' },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  documentTitle: String,
  signerName: { type: String, required: true },
  signerEmail: { type: String, required: true },
  token: { type: String, required: true, unique: true },
  status: { type: String, enum: ['sent', 'signed', 'declined', 'expired'], default: 'sent' },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  signedAt: Date,
  signedName: String,
  signerIp: String,
  hash: String,
  declinedReason: String,
  expiresAt: Date,
  provider: { type: String, enum: ['internal', 'docusign'], default: 'internal' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.SignatureRequest || mongoose.model('SignatureRequest', signatureRequestSchema);
