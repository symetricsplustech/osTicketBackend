const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const evalSetSchema = new mongoose.Schema({
  name: { type: String, required: true }, tool: String,
  cases: [{ input: mongoose.Schema.Types.Mixed, expectContains: [String] }],
  lastScore: Number, lastRunAt: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.EvalSet || mongoose.model('EvalSet', evalSetSchema);
