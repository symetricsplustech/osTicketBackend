const mongoose = require('mongoose');
const changeCalendarSchema = new mongoose.Schema({
  change: { type: mongoose.Schema.Types.ObjectId, ref: 'Change' },
  title: String,
  start: { type: Date, required: true },
  end: { type: Date, required: true },
  type: { type: String, enum: ['change', 'maintenance', 'freeze'], default: 'change' },
  color: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.ChangeCalendar || mongoose.model('ChangeCalendar', changeCalendarSchema);
