const mongoose = require('mongoose');
const cabMinuteSchema = new mongoose.Schema({
  change: { type: mongoose.Schema.Types.ObjectId, ref: 'Change', required: true },
  meetingDate: Date, attendees: [String],
  decision: { type: String, enum: ['approved', 'rejected', 'deferred'], default: 'deferred' },
  minutesText: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.CabMinute || mongoose.model('CabMinute', cabMinuteSchema);
