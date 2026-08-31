const mongoose = require('mongoose');
const licenseAllocationSchema = new mongoose.Schema({
  license: { type: mongoose.Schema.Types.ObjectId, ref: 'License', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
  allocatedDate: { type: Date, default: Date.now },
  deactivatedDate: Date,
  status: { type: String, enum: ['active', 'deactivated', 'expired'], default: 'active' },
  notes: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
licenseAllocationSchema.index({ license: 1, user: 1 });
licenseAllocationSchema.index({ license: 1, asset: 1 });
module.exports = mongoose.models.LicenseAllocation || mongoose.model('LicenseAllocation', licenseAllocationSchema);
