const mongoose = require('mongoose');
const demandItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  businessUnit: String,
  estimatedCost: { type: Number, default: 0 },
  expectedBenefit: String,
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  score: { type: Number, default: 0 },
  status: { type: String, enum: ['submitted', 'under_review', 'approved', 'rejected', 'converted'], default: 'submitted' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  convertedProject: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.DemandItem || mongoose.model('DemandItem', demandItemSchema);
