const mongoose = require('mongoose');
const patchCampaignSchema = new mongoose.Schema({
  name: { type: String, required: true },
  vulnerabilities: [mongoose.Schema.Types.ObjectId],
  maintenanceWindow: Date, status: { type: String, enum: ['draft', 'scheduled', 'running', 'done'], default: 'draft' },
  remediationTaskIds: [mongoose.Schema.Types.ObjectId],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.PatchCampaign || mongoose.model('PatchCampaign', patchCampaignSchema);
