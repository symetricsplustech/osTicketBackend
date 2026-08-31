const mongoose = require('mongoose');
const procurementSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  vendor: String,
  quantity: { type: Number, required: true, min: 1 },
  unitCost: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'pending_approval', 'approved', 'ordered', 'received', 'cancelled'], default: 'draft' },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  approvedAt: Date,
  orderedAt: Date,
  expectedDelivery: Date,
  receivedAt: Date,
  receivedQuantity: { type: Number, default: 0 },
  stockroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Stockroom' },
  notes: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
}, { timestamps: true });
procurementSchema.index({ status: 1 });
module.exports = mongoose.models.Procurement || mongoose.model('Procurement', procurementSchema);
