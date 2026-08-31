const mongoose = require('mongoose');
const suspensionRecordSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  reason: { type: String, enum: ['payment_failure', 'manual', 'trial_expired'], default: 'payment_failure' },
  detail: String,
  active: { type: Boolean, default: true },
  suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  restoredAt: Date,
  autoRestoreJobQueued: Boolean,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.SuspensionRecord || mongoose.model('SuspensionRecord', suspensionRecordSchema);
