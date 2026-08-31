const mongoose = require('mongoose');
const salesForecastSchema = new mongoose.Schema({
  period: { type: String, enum: ['weekly', 'monthly', 'quarterly', 'yearly'], required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  forecastAmount: { type: Number, default: 0 },
  actualAmount: { type: Number, default: 0 },
  pipelineValue: { type: Number, default: 0 },
  weightedValue: { type: Number, default: 0 },
  confidence: { type: Number, min: 0, max: 100, default: 50 },
  breakdown: [{ stage: String, count: Number, value: Number, weightedValue: Number }],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
}, { timestamps: true });
module.exports = mongoose.models.SalesForecast || mongoose.model('SalesForecast', salesForecastSchema);
