const mongoose = require('mongoose');
const esgMetricSchema = new mongoose.Schema({
  name: { type: String, required: true },
  framework: { type: String, enum: ['GRI', 'SASB', 'TCFD', 'CSRD', 'BRSR', 'internal'], default: 'GRI' },
  pillar: { type: String, enum: ['environmental', 'social', 'governance'], default: 'environmental' },
  scope: { type: String, enum: ['scope_1', 'scope_2', 'scope_3', 'na'], default: 'na' },
  unit: String,
  frequency: { type: String, enum: ['monthly', 'quarterly', 'annual'], default: 'monthly' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  facility: String,
  dataPoints: [{ period: String, value: Number, emissionFactorId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmissionFactor' }, co2e: Number, evidenceUrl: String, validatedBy: String, restatedFrom: Number }],
  targetValue: Number,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.EsgMetric || mongoose.model('EsgMetric', esgMetricSchema);
