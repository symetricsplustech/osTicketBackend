const mongoose = require('mongoose');
const softwareProductSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  vendor: String,
  category: { type: String, enum: ['os', 'productivity', 'development', 'security', 'utility', 'other'], default: 'other' },
  versions: [{ version: String, releaseDate: Date, endOfSupport: Date }],
  latestVersion: String,
  description: String,
  website: String,
  status: { type: String, enum: ['active', 'end_of_support', 'discontinued'], default: 'active' },
  metadata: mongoose.Schema.Types.Mixed,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
softwareProductSchema.index({ name: 'text', vendor: 'text' });
module.exports = mongoose.models.SoftwareProduct || mongoose.model('SoftwareProduct', softwareProductSchema);
