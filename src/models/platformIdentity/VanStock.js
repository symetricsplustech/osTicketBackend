const mongoose = require('mongoose');
const vanStockSchema = new mongoose.Schema({
  technician: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', unique: true },
  items: [{ product: mongoose.Schema.Types.ObjectId, qty: Number }],
  consumptions: [{ workOrder: mongoose.Schema.Types.ObjectId, product: mongoose.Schema.Types.ObjectId, qty: Number, at: Date }],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.VanStock || mongoose.model('VanStock', vanStockSchema);
