const mongoose = require('mongoose');
const assetLifecycleSchema = new mongoose.Schema({
  asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  status: { type: String, enum: ['requested', 'approved', 'ordered', 'received', 'in_stock', 'assigned', 'in_use', 'maintenance', 'retired', 'disposed'], default: 'requested' },
  history: [{
    status: String,
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
    notes: String,
  }],
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  disposedAt: Date,
  disposalMethod: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
assetLifecycleSchema.index({ asset: 1 });
assetLifecycleSchema.index({ status: 1 });
module.exports = mongoose.models.AssetLifecycle || mongoose.model('AssetLifecycle', assetLifecycleSchema);
