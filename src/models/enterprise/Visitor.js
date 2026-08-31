const mongoose = require('mongoose');
const visitorSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  company: String,
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  building: { type: mongoose.Schema.Types.ObjectId, ref: 'Building' },
  visitDate: Date,
  purpose: String,
  badgePrinted: Boolean,
  checkInAt: Date,
  checkOutAt: Date,
  watchlistHit: Boolean,
  status: { type: String, enum: ['preregistered', 'checked_in', 'checked_out', 'no_show'], default: 'preregistered' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.Visitor || mongoose.model('Visitor', visitorSchema);
