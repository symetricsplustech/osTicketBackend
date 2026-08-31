const mongoose = require('mongoose');
const workplaceCaseSchema = new mongoose.Schema({
  number: String,
  title: { type: String, required: true },
  caseType: { type: String, enum: ['maintenance', 'cleaning', 'inspection', 'health_safety', 'catering', 'security', 'other'], default: 'maintenance' },
  location: { type: mongoose.Schema.Types.ObjectId, ref: 'Building' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  status: { type: String, enum: ['open', 'assigned', 'in_progress', 'resolved', 'closed'], default: 'open' },
  assignedVendor: String,
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.WorkplaceCase || mongoose.model('WorkplaceCase', workplaceCaseSchema);
