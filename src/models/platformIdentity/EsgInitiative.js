const mongoose = require('mongoose');
const esgInitiativeSchema = new mongoose.Schema({
  metric: { type: mongoose.Schema.Types.ObjectId, ref: 'EsgMetric', required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  description: String, targetReductionPct: Number,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.EsgInitiative || mongoose.model('EsgInitiative', esgInitiativeSchema);
