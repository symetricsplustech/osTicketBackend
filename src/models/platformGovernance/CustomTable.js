const mongoose = require('mongoose');
const customTableSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  label: String,
  fields: [{ name: String, type: { type: String, enum: ['string', 'number', 'date', 'boolean', 'select'] }, options: [String], required: Boolean }],
  status: { type: String, enum: ['active', 'archived'], default: 'active' },
  recordCount: { type: Number, default: 0 },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.CustomTable || mongoose.model('CustomTable', customTableSchema);
