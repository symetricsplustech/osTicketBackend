const mongoose = require('mongoose');
const technicianAvailabilitySchema = new mongoose.Schema({
  technician: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true },
  date: { type: Date, required: true },
  slots: [{ start: String, end: String, status: { type: String, enum: ['available', 'booked', 'off'], default: 'available' }, workOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder' } }],
  region: String,
  skills: [String],
  notes: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
technicianAvailabilitySchema.index({ technician: 1, date: 1 }, { unique: true });
module.exports = mongoose.models.TechnicianAvailability || mongoose.model('TechnicianAvailability', technicianAvailabilitySchema);
