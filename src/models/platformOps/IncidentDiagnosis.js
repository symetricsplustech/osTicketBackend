const mongoose = require('mongoose');
const incidentDiagnosisSchema = new mongoose.Schema({
  incident: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', required: true },
  symptoms: [String],
  affectedSystems: [String],
  rootCauseCategory: { type: String, enum: ['hardware', 'software_bug', 'configuration', 'capacity', 'network', 'third_party', 'human_error', 'security', 'unknown'], default: 'unknown' },
  triggerEvent: String,
  contributingFactors: [String],
  confidenceLevel: { type: Number, min: 0, max: 100 },
  diagnosedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
incidentDiagnosisSchema.index({ incident: 1 }, { unique: true });
module.exports = mongoose.models.IncidentDiagnosis || mongoose.model('IncidentDiagnosis', incidentDiagnosisSchema);
