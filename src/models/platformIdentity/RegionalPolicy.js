const mongoose = require('mongoose');
const regionalPolicySchema = new mongoose.Schema({
    region: { type: String, required: true },
    piiExportBlocklistFields: [String],
    retentionOverrideDays: Number,
    tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  }, { timestamps: true });
module.exports = mongoose.models.RegionalPolicy || mongoose.model('RegionalPolicy', regionalPolicySchema);
