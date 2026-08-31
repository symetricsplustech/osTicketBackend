const mongoose = require('mongoose');
const reservationSchema = new mongoose.Schema({
  space: { type: mongoose.Schema.Types.ObjectId, ref: 'Space', required: true },
  reservedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date: { type: Date, required: true },
  startSlot: String,
  endSlot: String,
  recurring: { type: String, enum: ['none', 'daily', 'weekly'], default: 'none' },
  status: { type: String, enum: ['reserved', 'checked_in', 'released_no_show', 'cancelled'], default: 'reserved' },
  checkedInAt: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
reservationSchema.index({ space: 1, date: 1 });
module.exports = mongoose.models.Reservation || mongoose.model('Reservation', reservationSchema);
