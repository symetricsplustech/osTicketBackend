const mongoose = require('mongoose');
const entraSyncSchema = new mongoose.Schema({
  domain: String, enabled: Boolean,
  autoProvision: { type: Boolean, default: true },
  lastRunAt: Date, lastDiff: mongoose.Schema.Types.Mixed,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.EntraSync || mongoose.model('EntraSync', entraSyncSchema);
