const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const communicationPlanSchema = new mongoose.Schema({
  incident: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', required: true },
  cadenceMinutes: { type: Number, default: 60 }, audience: [{ type: String, enum: ['internal', 'customer', 'public'] }],
  nextUpdateAt: Date, updatesSent: { type: Number, default: 0 },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.CommunicationPlan || mongoose.model('CommunicationPlan', communicationPlanSchema);
