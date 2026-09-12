const { Schema, model } = require('mongoose');
const ContactPreferenceSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  onCallEmail: { type: String, trim: true, default: '' },
  onCallSms: { type: String, trim: true, default: '' },
  onCallVoice: { type: String, trim: true, default: '' },
  onCallSlack: { type: String, trim: true, default: '' },
  onCallTeams: { type: String, trim: true, default: '' },
  preferredOrder: [{ type: String, enum: ['email', 'sms', 'voice', 'slack', 'teams', 'push'] }],
  quietHours: {
    enabled: { type: Boolean, default: false },
    start: { type: String, default: '22:00' },
    end: { type: String, default: '07:00' },
    timezone: { type: String, default: 'UTC' },
  },
  escalationMode: { type: String, enum: ['parallel', 'sequential'], default: 'parallel' },
  acknowledgeTimeoutMinutes: { type: Number, default: 5 },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });
ContactPreferenceSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
module.exports = model('ContactPreference', ContactPreferenceSchema);
