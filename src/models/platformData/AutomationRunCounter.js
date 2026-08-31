const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const automationRunCounterSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true }, period: String,
  runs: { type: Number, default: 0 },
}, { timestamps: true });
module.exports = mongoose.models.AutomationRunCounter || mongoose.model('AutomationRunCounter', automationRunCounterSchema);
