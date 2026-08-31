const mongoose = require('mongoose');
const installedProductSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
  installDate: { type: Date, default: Date.now },
  version: String,
  status: { type: String, enum: ['installed', 'uninstalled', 'pending_update'], default: 'installed' },
  licenseKey: String,
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
installedProductSchema.index({ customer: 1, product: 1 });
module.exports = mongoose.models.InstalledProduct || mongoose.model('InstalledProduct', installedProductSchema);
