const mongoose = require('mongoose');
const onCallScheduleSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  description: String,
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  rotations: [{
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
    startDate: Date,
    endDate: Date,
    order: Number,
  }],
  escalation: [{
    order: Number,
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
    delayMinutes: Number,
    notifyMethod: { type: String, enum: ['email', 'sms', 'phone'], default: 'email' },
  }],
  schedule: { type: String, enum: ['weekly', 'biweekly', 'monthly'], default: 'weekly' },
  timezone: { type: String, default: 'UTC' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
}, { timestamps: true });
onCallScheduleSchema.index({ status: 1 });
module.exports = mongoose.models.OnCallSchedule || mongoose.model('OnCallSchedule', onCallScheduleSchema);
