const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const attestationCampaignSchema = new mongoose.Schema({
  name: { type: String, required: true }, cis: [mongoose.Schema.Types.ObjectId],
  owner: oid, dueAt: Date,
  responses: [{ ci: mongoose.Schema.Types.ObjectId, certified: Boolean, notes: String, at: Date }],
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.AttestationCampaign || mongoose.model('AttestationCampaign', attestationCampaignSchema);
