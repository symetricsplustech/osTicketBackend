const mongoose = require('mongoose');
const productSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  sku: { type: String, unique: true, sparse: true },
  description: String,
  category: { type: String, enum: ['software', 'hardware', 'service', 'subscription', 'other'], default: 'other' },
  vendor: String,
  cost: { type: Number, default: 0 },
  price: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'discontinued', 'end_of_life'], default: 'active' },
  version: String,
  unit: { type: String, enum: ['license', 'seat', 'unit', 'hour', 'month', 'year'], default: 'unit' },
  metadata: mongoose.Schema.Types.Mixed,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
}, { timestamps: true });
productSchema.index({ name: 'text', sku: 'text', description: 'text' });
module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);
