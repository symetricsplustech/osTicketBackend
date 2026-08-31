const mongoose = require('mongoose');
const licenseSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  vendor: String,
  key: String,
  type: { type: String, enum: ['per_user', 'per_device', 'site', 'concurrent', 'trial', 'open_source'], default: 'per_user' },
  totalSeats: { type: Number, required: true, default: 1 },
  usedSeats: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'expired', 'suspended', 'reserved'], default: 'active' },
  purchaseDate: Date,
  expiryDate: { type: Date, required: true },
  renewalDate: Date,
  cost: { type: Number, default: 0 },
  autoRenew: { type: Boolean, default: false },
  alertBeforeExpiry: { type: Number, default: 30 },
  lastAlerted: Date,
  notes: String,
  metadata: mongoose.Schema.Types.Mixed,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
}, { timestamps: true });
licenseSchema.index({ name: 'text', vendor: 'text' });
licenseSchema.index({ expiryDate: 1 });
licenseSchema.index({ status: 1 });
module.exports = mongoose.models.License || mongoose.model('License', licenseSchema);
