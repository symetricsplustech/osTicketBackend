const mongoose = require('mongoose');

const majorIncidentParticipantSchema = new mongoose.Schema(
  {
    majorIncident: { type: mongoose.Schema.Types.ObjectId, ref: 'MajorIncident', required: true, index: true },
    incident: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', required: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: {
      type: String,
      enum: ['commander', 'technical_lead', 'communications', 'subject_matter_expert', 'stakeholder'],
      required: true,
    },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

majorIncidentParticipantSchema.index({ majorIncident: 1, user: 1 }, { unique: true });
majorIncidentParticipantSchema.index({ company: 1, incident: 1 });

module.exports = mongoose.model('MajorIncidentParticipant', majorIncidentParticipantSchema);
