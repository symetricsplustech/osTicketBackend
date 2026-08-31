const mongoose = require('mongoose');
const installedSoftwareSchema = new mongoose.Schema({
  asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  software: { type: mongoose.Schema.Types.ObjectId, ref: 'SoftwareProduct', required: true },
  version: String,
  installDate: Date,
  uninstallDate: Date,
  status: { type: String, enum: ['installed', 'uninstalled', 'pending'], default: 'installed' },
  publisher: String,
  installPath: String,
  size: Number,
  isSystem: { type: Boolean, default: false },
  lastChecked: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
installedSoftwareSchema.index({ asset: 1, software: 1 });
installedSoftwareSchema.index({ status: 1 });
module.exports = mongoose.models.InstalledSoftware || mongoose.model('InstalledSoftware', installedSoftwareSchema);
