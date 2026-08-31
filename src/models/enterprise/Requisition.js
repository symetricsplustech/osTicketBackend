const mongoose = require('mongoose');
const requisitionSchema = new mongoose.Schema({
  number: String,
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  businessNeed: String,
  lines: [{ description: String, quantity: Number, estUnitPrice: Number, accountingCode: String, preferredSupplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' } }],
  totalEstimate: Number,
  neededBy: Date,
  approvals: [{ approverRole: String, decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' }, decision: String, decidedAt: Date }],
  status: { type: String, enum: ['draft', 'pending_approval', 'approved', 'po_created', 'received', 'closed'], default: 'draft' },
  purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Procurement' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.Requisition || mongoose.model('Requisition', requisitionSchema);
