const mongoose = require('mongoose');

const problemIncidentSchema = new mongoose.Schema(
  {
    problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true, index: true },
    incident: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    linkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    linkedAt: { type: Date, default: Date.now },
    isPrimary: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

problemIncidentSchema.index({ problem: 1, incident: 1 }, { unique: true });
problemIncidentSchema.index({ company: 1, problem: 1 });

module.exports = mongoose.model('ProblemIncident', problemIncidentSchema);
