const mongoose = require('mongoose');
const importErrorRowSchema = new mongoose.Schema({
  row: Number,
  errors: [String],
}, { _id: false, suppressReservedKeysWarning: true });
const importBatchSchema = new mongoose.Schema({
  entity: { type: String, enum: ['lead', 'asset', 'contact'], required: true },
  transformMap: mongoose.Schema.Types.Mixed,
  rows: [mongoose.Schema.Types.Mixed],
  validRows: Number, errorRows: [importErrorRowSchema],
  committed: { type: Boolean, default: false }, committedCount: Number,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.ImportBatch || mongoose.model('ImportBatch', importBatchSchema);
