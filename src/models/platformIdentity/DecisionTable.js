const mongoose = require('mongoose');
const decisionTableSchema = new mongoose.Schema({
  name: { type: String, required: true },
  conditionColumns: [String],
  outputField: String,
  rows: [[mongoose.Schema.Types.Mixed]],
  effectiveFrom: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.DecisionTable || mongoose.model('DecisionTable', decisionTableSchema);
