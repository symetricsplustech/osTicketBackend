const { Schema, model } = require('mongoose');
const RotationSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  scheduleId: { type: Schema.Types.ObjectId, ref: 'OnCallSchedule', required: true, index: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['daily', 'weekly', 'biweekly', 'monthly', 'custom'], default: 'weekly' },
  pattern: {
    days: [{ type: Number }], // 0=Sun..6=Sat
    startTime: { type: String, default: '09:00' },
    durationDays: { type: Number, default: 7 },
    handoverDay: { type: Number, default: 1 }, // Monday
    handoverTime: { type: String, default: '09:00' },
  },
  members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  currentIndex: { type: Number, default: 0 },
  nextHandoverDate: { type: Date },
  status: { type: String, enum: ['active', 'paused', 'completed'], default: 'active' },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
RotationSchema.index({ tenantId: 1, scheduleId: 1, status: 1 });
module.exports = model('Rotation', RotationSchema);
