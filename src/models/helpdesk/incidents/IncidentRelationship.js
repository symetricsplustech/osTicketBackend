const mongoose = require('mongoose');

const incidentRelationshipSchema = new mongoose.Schema(
  {
    sourceIncident: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', required: true, index: true },
    targetIncident: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', required: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    relationshipType: {
      type: String,
      enum: ['parent_child', 'duplicates', 'relates_to', 'caused_by', 'blocks', 'blocked_by'],
      required: true,
    },
    linkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    linkedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

incidentRelationshipSchema.index({ sourceIncident: 1, targetIncident: 1 }, { unique: true });
incidentRelationshipSchema.index({ company: 1, sourceIncident: 1 });
incidentRelationshipSchema.index({ company: 1, targetIncident: 1 });

module.exports = mongoose.model('IncidentRelationship', incidentRelationshipSchema);
