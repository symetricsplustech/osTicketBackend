const mongoose = require('mongoose');
const onPremAgentSchema = new mongoose.Schema({
  name: { type: String, required: true }, enrollKey: String,
  lastHeartbeat: Date, capabilities: [String],
  queuedJobs: [{ type: String, params: mongoose.Schema.Types.Mixed, issuedAt: Date, result: String }],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.OnPremAgent || mongoose.model('OnPremAgent', onPremAgentSchema);
