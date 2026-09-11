const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true, index: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fulfilledFor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['pending', 'in_progress', 'fulfilled', 'cancelled', 'failed'], default: 'pending', index: true },
  requestedItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'RequestedItem' }],
  failureReason: { type: String, default: '' },
}, { timestamps: true });

serviceRequestSchema.index({ company: 1, requester: 1, createdAt: -1 });

module.exports = mongoose.models.ServiceRequest || mongoose.model('ServiceRequest', serviceRequestSchema);
