const mongoose = require('mongoose');
const fileVersionSchema = new mongoose.Schema({
  entityType: String, entityId: mongoose.Schema.Types.ObjectId,
  filename: String, url: String, version: { type: Number, default: 1 },
  uploadedBy: mongoose.Schema.Types.ObjectId,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.FileVersion || mongoose.model('FileVersion', fileVersionSchema);
