const mongoose = require('mongoose');
const sequenceEnrollmentSchema = new mongoose.Schema({
  sequence: { type: mongoose.Schema.Types.ObjectId, ref: 'ActivitySequence', required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  targetType: { type: String, enum: ['lead', 'opportunity', 'contact'], required: true },
  cursor: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'completed', 'stopped'], default: 'active' },
  nextRunAt: Date,
  log: [{ stepIndex: Number, type: String, at: { type: Date, default: Date.now }, result: String }],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.SequenceEnrollment || mongoose.model('SequenceEnrollment', sequenceEnrollmentSchema);
