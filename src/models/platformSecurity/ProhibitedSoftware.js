const mongoose = require('mongoose');
const prohibitedSoftwareSchema = new mongoose.Schema({
  name: { type: String, required: true },
  vendor: String,
  matchType: { type: String, enum: ['exact', 'contains'], default: 'contains' },
  severity: { type: String, enum: ['warning', 'violation'], default: 'violation' },
  reason: String,
  active: { type: Boolean, default: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
prohibitedSoftwareSchema.index({ name: 1, tenantId: 1 });
module.exports = mongoose.models.ProhibitedSoftware || mongoose.model('ProhibitedSoftware', prohibitedSoftwareSchema);
