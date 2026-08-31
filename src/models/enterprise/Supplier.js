const mongoose = require('mongoose');
const supplierSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  taxId: String,
  bankValidated: Boolean,
  documents: [{ type: String, url: String, verified: Boolean }],
  performanceRating: { type: Number, min: 0, max: 5 },
  diversityCertified: Boolean,
  sustainabilityScore: Number,
  onboardingStatus: { type: String, enum: ['prospect', 'registered', 'validated', 'approved', 'blocked'], default: 'prospect' },
  contacts: [{ name: String, email: String, phone: String }],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.Supplier || mongoose.model('Supplier', supplierSchema);
