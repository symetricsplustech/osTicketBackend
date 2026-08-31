const mongoose = require('mongoose');
const dsarRequestSchema = new mongoose.Schema({
  type: { type: String, enum: ['access', 'delete', 'correct'], required: true },
  subjectEmail: { type: String, required: true },
  status: { type: String, enum: ['received', 'verifying', 'in_progress', 'completed', 'rejected'], default: 'received' },
  dueAt: Date, exportPayload: mongoose.Schema.Types.Mixed, correction: String,
  handledBy: mongoose.Schema.Types.ObjectId,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.DsarRequest || mongoose.model('DsarRequest', dsarRequestSchema);
