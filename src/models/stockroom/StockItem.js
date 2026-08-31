const mongoose = require('mongoose');
const stockItemSchema = new mongoose.Schema({
  stockroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Stockroom', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, default: 0, min: 0 },
  reservedQuantity: { type: Number, default: 0, min: 0 },
  reorderLevel: { type: Number, default: 0 },
  reorderQuantity: { type: Number, default: 0 },
  unitCost: { type: Number, default: 0 },
  lastRestocked: Date,
  location: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
stockItemSchema.index({ stockroom: 1, product: 1 });
module.exports = mongoose.models.StockItem || mongoose.model('StockItem', stockItemSchema);
