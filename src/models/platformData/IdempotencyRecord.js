const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const idempotencyRecordSchema = new mongoose.Schema({
  key: { type: String, required: true }, scope: String,
  responseBody: mongoose.Schema.Types.Mixed, status: Number,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
idempotencyRecordSchema.index({ key: 1, scope: 1 }, { unique: true });
module.exports = mongoose.models.IdempotencyRecord || mongoose.model('IdempotencyRecord', idempotencyRecordSchema);
