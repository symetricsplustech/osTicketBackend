const mongoose = require('mongoose');
const discoveryScheduleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  scopeType: { type: String, enum: ['network_range', 'cloud_account', 'kubernetes', 'container'], required: true },
  target: String, credentialId: mongoose.Schema.Types.ObjectId,
  cronHint: String, lastStatus: String, lastFindings: Number,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.DiscoverySchedule || mongoose.model('DiscoverySchedule', discoveryScheduleSchema);
