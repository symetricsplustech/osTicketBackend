const mongoose = require('mongoose');

const statusIncidentSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    statusPage: { type: mongoose.Schema.Types.ObjectId, ref: 'StatusPage', default: null, index: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    status: {
      type: String,
      enum: ['investigating', 'identified', 'monitoring', 'resolved', 'maintenance'],
      default: 'investigating',
    },
    severity: { type: String, enum: ['critical', 'major', 'minor', 'maintenance'], default: 'major' },
    componentsAffected: { type: [String], default: [] },
    updates: [
      {
        at: { type: Date, default: Date.now },
        status: { type: String, default: '' },
        message: { type: String, default: '' },
      },
    ],
    startedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
    linkedIncident: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', default: null },
    linkedTickets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
  },
  { timestamps: true }
);

statusIncidentSchema.index({ company: 1, statusPage: 1, status: 1 });

module.exports = mongoose.model('StatusIncident', statusIncidentSchema);