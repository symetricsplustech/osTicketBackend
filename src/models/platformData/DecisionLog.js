const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const decisionLogSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },
  decision: { type: String, required: true }, owner: oid,
  decidedAt: Date, rationale: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.DecisionLog || mongoose.model('DecisionLog', decisionLogSchema);
