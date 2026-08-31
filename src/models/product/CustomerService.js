const mongoose = require('mongoose');
const customerServiceSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  status: { type: String, enum: ['active', 'suspended', 'cancelled'], default: 'active' },
  startDate: { type: Date, default: Date.now },
  endDate: Date,
  contractRef: String,
  seats: { type: Number, default: 1 },
  monthlyCost: { type: Number, default: 0 },
  autoRenew: { type: Boolean, default: true },
  notes: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
customerServiceSchema.index({ customer: 1, service: 1 });
module.exports = mongoose.models.CustomerService || mongoose.model('CustomerService', customerServiceSchema);
