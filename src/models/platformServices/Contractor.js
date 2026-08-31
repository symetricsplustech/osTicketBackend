const mongoose = require('mongoose');
const contractorSchema = new mongoose.Schema({
  name: { type: String, required: true }, company: String,
  skills: [String], hourlyRate: Number, currency: { type: String, default: 'USD' },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  assignmentsCompleted: { type: Number, default: 0 },
  status: { type: String, enum: ['available', 'assigned', 'blocked'], default: 'available' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.Contractor || mongoose.model('Contractor', contractorSchema);
