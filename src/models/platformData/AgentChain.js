const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const agentChainSchema = new mongoose.Schema({
  name: { type: String, required: true },
  steps: [{ agent: mongoose.Schema.Types.ObjectId, tool: String, inputTemplate: String }],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.AgentChain || mongoose.model('AgentChain', agentChainSchema);
