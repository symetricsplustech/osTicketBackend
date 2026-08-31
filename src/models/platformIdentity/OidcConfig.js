const mongoose = require('mongoose');
const oidcConfigSchema = new mongoose.Schema({
  issuerUrl: String, clientId: String, clientSecretEnc: String,
  redirectUri: String, scopes: { type: [String], default: ['openid', 'profile', 'email'] },
  enabled: Boolean,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.OidcConfig || mongoose.model('OidcConfig', oidcConfigSchema);
