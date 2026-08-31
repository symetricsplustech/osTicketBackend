const mongoose = require('mongoose');
const policyAcknowledgementSchema = new mongoose.Schema({
  policy: { type: String, required: true },
  version: String,
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  acknowledged: { type: Boolean, default: false },
  acknowledgedAt: Date,
  dueDate: Date,
  overdue: { type: Boolean, default: false },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.PolicyAcknowledgement || mongoose.model('PolicyAcknowledgement', policyAcknowledgementSchema);
