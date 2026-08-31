const mongoose = require('mongoose');
const softwareImportBatchSchema = new mongoose.Schema({
  asset: mongoose.Schema.Types.ObjectId, agentVersion: String,
  rowsCount: Number, matchedProducts: Number, createdProducts: Number, unknownRows: Number,
  results: [{ rawName: String, matchedProductId: mongoose.Schema.Types.ObjectId, version: String }],
  importedBy: mongoose.Schema.Types.ObjectId,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.SoftwareImportBatch || mongoose.model('SoftwareImportBatch', softwareImportBatchSchema);
