const mongoose = require('mongoose');

const incidentServiceOfferingSchema = new mongoose.Schema(
  {
    incident: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', required: true, index: true },
    serviceOffering: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceOffering', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    linkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    linkedAt: { type: Date, default: Date.now },
    role: { type: String, enum: ['primary', 'affected', 'related'], default: 'affected' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

incidentServiceOfferingSchema.index({ incident: 1, serviceOffering: 1 }, { unique: true });
incidentServiceOfferingSchema.index({ company: 1, incident: 1 });

module.exports = mongoose.model('IncidentServiceOffering', incidentServiceOfferingSchema);
