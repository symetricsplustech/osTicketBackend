const mongoose = require('mongoose');
const connectorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  system: { type: String, enum: ['m365', 'slack', 'jira', 'github', 'gitlab', 'teams', 'custom'], required: true },
  configUrl: String, secretMasked: String, secretEncrypted: String,
  status: { type: String, enum: ['untested', 'healthy', 'failing'], default: 'untested' },
  lastTestedAt: Date, lastSuccessAt: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.Connector || mongoose.model('Connector', connectorSchema);
