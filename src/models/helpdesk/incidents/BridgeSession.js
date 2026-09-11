const { Schema, model } = require('mongoose');
const BridgeSessionSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  majorIncidentId: { type: Schema.Types.ObjectId, ref: 'MajorIncident', required: true, index: true },
  provider: { type: String, enum: ['zoom', 'teams', 'webex', 'google_meet', 'custom', 'voice'], default: 'voice' },
  meetingId: { type: String, trim: true, default: '' },
  meetingUrl: { type: String, trim: true, default: '' },
  dialInNumber: { type: String, trim: true, default: '' },
  accessCode: { type: String, trim: true, default: '' },
  hostId: { type: Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['scheduled', 'active', 'ended', 'cancelled'], default: 'scheduled', index: true },
  startedAt: { type: Date },
  endedAt: { type: Date },
  duration: { type: Number, default: 0 },
  participantCount: { type: Number, default: 0 },
  recordingUrl: { type: String, trim: true, default: '' },
  recordingEnabled: { type: Boolean, default: true },
  autoJoin: { type: Boolean, default: false },
  meta: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });
BridgeSessionSchema.index({ tenantId: 1, majorIncidentId: 1, status: 1 });
module.exports = model('BridgeSession', BridgeSessionSchema);
