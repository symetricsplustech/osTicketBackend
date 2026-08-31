const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const scenarioSchema = new mongoose.Schema({
  name: { type: String, required: true },
  projectIds: [mongoose.Schema.Types.ObjectId], budgetShiftPct: Number,
  computedTotalBudget: Number, computedRiskAvg: Number,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.Scenario || mongoose.model('Scenario', scenarioSchema);
