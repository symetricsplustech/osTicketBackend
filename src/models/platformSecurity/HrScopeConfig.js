const mongoose = require('mongoose');
const hrScopeConfigSchema = new mongoose.Schema({
  agents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Agent' }],
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true, unique: true },
}, { timestamps: true });
module.exports = mongoose.models.HrScopeConfig || mongoose.model('HrScopeConfig', hrScopeConfigSchema);
