const mongoose = require('mongoose');
const orderSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    total: Number,
  }],
  subtotal: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'], default: 'pending' },
  paymentStatus: { type: String, enum: ['unpaid', 'paid', 'refunded', 'partial'], default: 'unpaid' },
  shippingAddress: { street: String, city: String, state: String, zip: String, country: String },
  billingAddress: { street: String, city: String, state: String, zip: String, country: String },
  notes: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
}, { timestamps: true });
orderSchema.index({ customer: 1 });
orderSchema.index({ status: 1 });
module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
