const mongoose = require('mongoose');

const majorIncidentCandidateSchema = new mongoose.Schema(
  {
    incident: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', required: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    nominatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    nominatedAt: { type: Date, default: Date.now },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' },
    justification: { type: String, default: '' },
  },
  { timestamps: true }
);

majorIncidentCandidateSchema.index({ company: 1, status: 1 });
majorIncidentCandidateSchema.index({ incident: 1 }, { unique: true });

module.exports = mongoose.model('MajorIncidentCandidate', majorIncidentCandidateSchema);
