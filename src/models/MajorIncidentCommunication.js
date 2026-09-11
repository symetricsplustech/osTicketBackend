const mongoose = require('mongoose');

const majorIncidentCommunicationSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  incident: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', required: true, index: true },
  audience: { type: String, enum: ['internal', 'customer', 'public'], required: true },
  message: { type: String, required: true, trim: true, maxlength: 5000 },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true },
  actorName: { type: String, default: '' },
  deliveredAt: { type: Date, default: Date.now },
}, { timestamps: true });

majorIncidentCommunicationSchema.index({ company: 1, incident: 1, createdAt: -1 });

module.exports = mongoose.models.MajorIncidentCommunication
  || mongoose.model('MajorIncidentCommunication', majorIncidentCommunicationSchema);
