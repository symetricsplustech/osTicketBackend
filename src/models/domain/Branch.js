const mongoose = require('mongoose');
const branchSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  address: { street: String, city: String, state: String, zip: String, country: String },
  phone: String,
  timezone: String,
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.Branch || mongoose.model('Branch', branchSchema);
