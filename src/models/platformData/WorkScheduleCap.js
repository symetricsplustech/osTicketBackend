const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const workScheduleCapSchema = new mongoose.Schema({
  agent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', unique: true },
  dailyMaxOpen: { type: Number, default: 10 }, weeklyHours: Number,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.WorkScheduleCap || mongoose.model('WorkScheduleCap', workScheduleCapSchema);
