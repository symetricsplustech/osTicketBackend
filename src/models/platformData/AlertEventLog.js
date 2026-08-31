const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const alertEventLogSchema = new mongoose.Schema({
  alert: { type: mongoose.Schema.Types.ObjectId, ref: 'Alert', index: true },
  event: { type: String, enum: ['opened', 'acknowledged', 'assigned', 'cleared', 'resolved'] },
  at: { type: Date, default: Date.now }, by: oid,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.AlertEventLog || mongoose.model('AlertEventLog', alertEventLogSchema);
