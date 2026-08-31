const mongoose = require('mongoose');
const workScheduleSchema = new mongoose.Schema({
  agent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', unique: true },
  timezone: String,
  shifts: [{ day: { type: String, enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] }, start: String, end: String }],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.WorkSchedule || mongoose.model('WorkSchedule', workScheduleSchema);
