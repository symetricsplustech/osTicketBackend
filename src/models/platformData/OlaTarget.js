const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const olaTargetSchema = new mongoose.Schema({
  name: { type: String, required: true }, internalTeam: String,
  responseMinutes: Number, resolutionMinutes: Number,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.OlaTarget || mongoose.model('OlaTarget', olaTargetSchema);
