const mongoose = require('mongoose');
const replacementSchema = new mongoose.Schema({
  originalAsset: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  replacementAsset: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  reason: String,
  replacedAt: { type: Date, default: Date.now },
  replacedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  notes: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.Replacement || mongoose.model('Replacement', replacementSchema);
