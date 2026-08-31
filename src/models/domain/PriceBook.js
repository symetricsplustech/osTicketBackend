const mongoose = require('mongoose');
const priceBookSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  description: String,
  currency: { type: String, default: 'USD' },
  items: [{ product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, name: String, price: Number, cost: Number }],
  isDefault: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.PriceBook || mongoose.model('PriceBook', priceBookSchema);
