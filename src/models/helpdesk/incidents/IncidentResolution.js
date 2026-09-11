const mongoose = require('mongoose');

const incidentResolutionSchema = new mongoose.Schema(
  {
    incident: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', required: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    resolutionCode: {
      type: String,
      enum: ['fixed', 'workaround', 'duplicate', 'not_reproducible', 'not_a_bug', 'user_error', 'by_design', 'third_party', 'will_not_fix'],
      required: true,
    },
    notes: { type: String, default: '' },
    rootCause: { type: String, default: '' },
    rootCauseCategory: {
      type: String,
      enum: ['code_defect', 'configuration', 'infrastructure', 'third_party', 'user_error', 'process_gap', 'unknown'],
      default: 'unknown',
    },
    workaround: { type: String, default: '' },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: Date.now },
    confirmedByUser: { type: Boolean, default: false },
    confirmedAt: { type: Date, default: null },
    isAutoClosed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

incidentResolutionSchema.index({ company: 1, incident: 1 });

module.exports = mongoose.model('IncidentResolution', incidentResolutionSchema);
