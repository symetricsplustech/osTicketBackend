const mongoose = require('mongoose');

const rootCauseRecordSchema = new mongoose.Schema(
  {
    problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    category: {
      type: String,
      enum: ['code_defect', 'configuration', 'infrastructure', 'third_party', 'human_error', 'process_gap', 'unknown'],
      required: true,
    },
    description: { type: String, default: '' },
    evidence: [{ type: String }],
    contributingFactors: [{ type: String }],
    detectionMethod: { type: String, default: '' },
    timeToDetect: { type: Number, default: 0 },
    identifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    identifiedAt: { type: Date, default: Date.now },
    isVerified: { type: Boolean, default: false },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

rootCauseRecordSchema.index({ company: 1, problem: 1 });

module.exports = mongoose.model('RootCauseRecord', rootCauseRecordSchema);
