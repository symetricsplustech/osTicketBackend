const mongoose = require('mongoose');
const fieldMaskingSchema = new mongoose.Schema({
  model: { type: String, required: true }, field: { type: String, required: true },
  maskType: { type: String, enum: ['full', 'partial', 'hash'], default: 'partial' },
  rolesAllowed: [String],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.FieldMasking || mongoose.model('FieldMasking', fieldMaskingSchema);
