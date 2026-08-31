const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const credentialVaultSchema = new mongoose.Schema({
  name: { type: String, required: true }, username: String,
  secretEncrypted: String, scopes: [String],
  rotatesAt: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.CredentialVault || mongoose.model('CredentialVault', credentialVaultSchema);
