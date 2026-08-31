const mongoose = require('mongoose');
const stockroomBinSchema = new mongoose.Schema({
  stockroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Stockroom', required: true },
  code: { type: String, required: true }, capacity: { type: Number, default: 10 },
  currentItems: [{ product: mongoose.Schema.Types.ObjectId, qty: Number }],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.StockroomBin || mongoose.model('StockroomBin', stockroomBinSchema);
