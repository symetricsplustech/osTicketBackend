const mongoose = require('mongoose');
const businessServiceSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  description: String,
  serviceType: { type: String, enum: ['business_service', 'technical_service', 'application_service'], default: 'business_service' },
  criticality: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  cis: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CI' }],
  healthScore: { type: Number, min: 0, max: 100, default: 100 },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.BusinessService || mongoose.model('BusinessService', businessServiceSchema);
