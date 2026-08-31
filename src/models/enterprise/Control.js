const mongoose = require('mongoose');
const controlSchema = new mongoose.Schema({
  name: { type: String, required: true },
  controlObjective: String,
  controlType: { type: String, enum: ['preventive', 'detective', 'corrective'], default: 'preventive' },
  frequency: { type: String, enum: ['continuous', 'daily', 'weekly', 'monthly', 'quarterly', 'annual'], default: 'monthly' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  authorityDocuments: [{ name: String, citation: String }],
  tests: [{ testedAt: Date, method: String, sampleSize: Number, result: { type: String, enum: ['effective', 'deficient'] }, evidenceUrl: String, testedBy: String }],
  effectiveness: { type: String, enum: ['effective', 'partially_effective', 'ineffective', 'untested'], default: 'untested' },
  mappedRisks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'RiskItem' }],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.Control || mongoose.model('Control', controlSchema);
