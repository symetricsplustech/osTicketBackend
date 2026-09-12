const { Schema, model } = require('mongoose');
const OnCallScheduleSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  number: { type: String, required: true, unique: true },
  timezone: { type: String, required: true, default: 'UTC' },
  team: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
  status: { type: String, enum: ['draft', 'active', 'paused', 'archived'], default: 'draft', index: true },
  scheduleType: { type: String, enum: ['weekly', 'biweekly', 'monthly', 'custom'], default: 'weekly' },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  handoverTime: { type: String, default: '09:00' }, // HH:mm in schedule timezone
  handoverDuration: { type: Number, default: 30 }, // minutes
  autoNotify: { type: Boolean, default: true },
  notifyBeforeMinutes: { type: Number, default: 30 },
  notifyChannels: [{ type: String, enum: ['email', 'sms', 'slack', 'teams', 'push', 'voice'], default: ['email'] }],
  escalationPolicyId: { type: Schema.Types.ObjectId, ref: 'EscalationPolicy' },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
OnCallScheduleSchema.index({ tenantId: 1, team: 1, status: 1, isDeleted: 1 });
module.exports = model('OnCallSchedule', OnCallScheduleSchema);
