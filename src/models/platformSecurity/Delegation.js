const mongoose = require('mongoose');
const delegationSchema = new mongoose.Schema({
  delegator: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true },
  delegate: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true },
  scopes: [{ type: String, enum: ['tickets', 'crm', 'reports', 'approvals'] }],
  reason: String,
  active: { type: Boolean, default: true },
  startsAt: { type: Date, default: Date.now },
  expiresAt: Date,
  revokedAt: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
delegationSchema.index({ delegator: 1, delegate: 1 });
module.exports = mongoose.models.Delegation || mongoose.model('Delegation', delegationSchema);
