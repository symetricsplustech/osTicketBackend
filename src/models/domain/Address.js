const mongoose = require('mongoose');
const addressSchema = new mongoose.Schema({
  entity: { type: String, enum: ['user', 'company', 'branch', 'ticket'], required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  type: { type: String, enum: ['billing', 'shipping', 'home', 'work', 'other'], default: 'work' },
  street: String,
  city: String,
  state: String,
  zip: String,
  country: String,
  isDefault: { type: Boolean, default: false },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.Address || mongoose.model('Address', addressSchema);
