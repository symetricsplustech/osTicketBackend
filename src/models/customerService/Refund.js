const mongoose = require('mongoose');
const refundSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
  complaint: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint' },
  amount: { type: Number, required: true, min: 0 },
  reason: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'processed'], default: 'pending' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  approvedAt: Date,
  processedAt: Date,
  refundMethod: { type: String, enum: ['credit_card', 'bank_transfer', 'store_credit', 'other'], default: 'credit_card' },
  notes: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
}, { timestamps: true });
refundSchema.index({ status: 1 });
module.exports = mongoose.models.Refund || mongoose.model('Refund', refundSchema);
