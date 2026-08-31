const mongoose = require('mongoose');
const priorityMatrixSchema = new mongoose.Schema({
  impact: { type: String, enum: ['low', 'medium', 'high'], required: true },
  urgency: { type: String, enum: ['low', 'medium', 'high'], required: true },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
priorityMatrixSchema.index({ impact: 1, urgency: 1 });
module.exports = mongoose.models.PriorityMatrix || mongoose.model('PriorityMatrix', priorityMatrixSchema);
