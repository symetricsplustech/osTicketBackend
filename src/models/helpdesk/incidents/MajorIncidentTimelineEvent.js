const mongoose = require('mongoose');

const majorIncidentTimelineEventSchema = new mongoose.Schema(
  {
    majorIncident: { type: mongoose.Schema.Types.ObjectId, ref: 'MajorIncident', required: true, index: true },
    incident: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', required: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    eventType: {
      type: String,
      enum: ['status_change', 'communication', 'decision', 'action', 'milestone', 'note', 'escalation'],
      required: true,
    },
    message: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    visibility: { type: String, enum: ['internal', 'external', 'stakeholder'], default: 'internal' },
    isAutomated: { type: Boolean, default: false },
  },
  { timestamps: true }
);

majorIncidentTimelineEventSchema.index({ company: 1, majorIncident: 1, createdAt: -1 });

module.exports = mongoose.model('MajorIncidentTimelineEvent', majorIncidentTimelineEventSchema);
