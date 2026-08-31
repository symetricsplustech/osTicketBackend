const mongoose = require('mongoose');
const riskItemSchema = new mongoose.Schema({
  refId: String,
  statement: { type: String, required: true },
  category: { type: String, enum: ['strategic', 'operational', 'financial', 'compliance', 'technology', 'third_party', 'security'], default: 'operational' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  likelihood: { type: String, enum: ['rare', 'unlikely', 'possible', 'likely', 'almost_certain'], default: 'possible' },
  impact: { type: String, enum: ['negligible', 'minor', 'moderate', 'major', 'severe'], default: 'moderate' },
  inherentScore: Number,
  residualScore: Number,
  appetiteExceeded: Boolean,
  treatment: { type: String, enum: ['mitigate', 'transfer', 'avoid', 'accept'], default: 'mitigate' },
  treatmentPlan: String,
  treatmentActions: [{ label: String, done: Boolean, dueDate: Date }],
  reviewDate: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.RiskItem || mongoose.model('RiskItem', riskItemSchema);
