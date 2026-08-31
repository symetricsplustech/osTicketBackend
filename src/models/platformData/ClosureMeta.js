const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const closureMetaSchema = new mongoose.Schema({
  ticketNumber: { type: String, unique: true, index: true },
  resolutionCode: String, closureCode: String,
  requesterConfirmed: Boolean, confirmedAt: Date, rejectedReason: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.ClosureMeta || mongoose.model('ClosureMeta', closureMetaSchema);
