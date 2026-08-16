const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    title: { type: String, required: true, trim: true },
    summary: { type: String, default: '' },
    severity: { type: String, enum: ['Sev1', 'Sev2', 'Sev3', 'Sev4'], default: 'Sev3' },
    status: {
      type: String,
      enum: ['investigating', 'identified', 'monitoring', 'resolved', 'closed'],
      default: 'investigating',
    },
    commander: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    affectedTickets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' }],
    affectedServices: { type: [String], default: [] },
    incidentCommander: { type: String, default: '' },
    timeline: [
      {
        at: { type: Date, default: Date.now },
        by: { type: String, default: '' },
        message: { type: String, default: '' },
      },
    ],
    updates: [
      {
        at: { type: Date, default: Date.now },
        status: { type: String, default: '' },
        message: { type: String, default: '' },
      },
    ],
    rootCase: { type: String, default: '' },
    rootCause: { type: String, default: '' },
    workaround: { type: String, default: '' },
    postmortem: { type: String, default: '' },
    resolution: { type: String, default: '' },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    startedAt: { type: Date, default: Date.now },
    notifiedStakeholders: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
  },
  { timestamps: true }
);

incidentSchema.index({ company: 1, status: 1 });
incidentSchema.statics.STATUSES = ['investigating', 'identified', 'monitoring', 'resolved', 'closed'];

module.exports = mongoose.model('Incident', incidentSchema);