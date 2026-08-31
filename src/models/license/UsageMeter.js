const mongoose = require('mongoose');
const usageMeterSchema = new mongoose.Schema({
  license: { type: mongoose.Schema.Types.ObjectId, ref: 'License', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date: { type: Date, required: true },
  usageMinutes: { type: Number, default: 0 },
  lastUsed: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
usageMeterSchema.index({ license: 1, date: 1 });
module.exports = mongoose.models.UsageMeter || mongoose.model('UsageMeter', usageMeterSchema);
