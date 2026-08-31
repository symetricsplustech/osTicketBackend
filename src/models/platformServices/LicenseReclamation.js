const mongoose = require('mongoose');
const licenseReclamationSchema = new mongoose.Schema({
  license: { type: mongoose.Schema.Types.ObjectId, ref: 'License', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lastUsedDays: Number,
  managerConfirmed: Boolean,
  status: { type: String, enum: ['flagged', 'manager_confirmed', 'reclaimed', 'kept'], default: 'flagged' },
  reclaimedAt: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.LicenseReclamation || mongoose.model('LicenseReclamation', licenseReclamationSchema);
