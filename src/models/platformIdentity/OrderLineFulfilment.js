const mongoose = require('mongoose');
const orderLineFulfilmentSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true },
  lines: [{ sku: String, qtyTotal: Number, qtyFulfilled: Number, warehouse: String, backordered: Boolean }],
  exception: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.OrderLineFulfilment || mongoose.model('OrderLineFulfilment', orderLineFulfilmentSchema);
