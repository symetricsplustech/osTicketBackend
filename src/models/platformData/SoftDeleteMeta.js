const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const softDeleteMetaSchema = new mongoose.Schema({
  ticketNumber: { type: String, unique: true, index: true },
  deletedAt: Date, restoredAt: Date, reason: String, by: oid,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.SoftDeleteMeta || mongoose.model('SoftDeleteMeta', softDeleteMetaSchema);
