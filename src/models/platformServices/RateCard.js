const mongoose = require('mongoose');
const rateCardSchema = new mongoose.Schema({
  role: { type: String, required: true },
  hourlyRate: { type: Number, required: true }, currency: { type: String, default: 'USD' },
  effectiveFrom: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.RateCard || mongoose.model('RateCard', rateCardSchema);
