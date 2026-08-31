const mongoose = require('mongoose');
const ssoConfigSchema = new mongoose.Schema({
  protocol: { type: String, enum: ['saml2', 'oidc'], default: 'saml2' },
  idpEntityId: String,
  idpSsoUrl: String,
  idpCertificate: String,
  spEntityId: String,
  acsUrl: String,
  attributeMappings: { email: { type: String, default: 'email' }, name: { type: String, default: 'displayName' }, groups: { type: String, default: 'groups' } },
  defaultRole: { type: String, enum: ['client', 'agent', 'admin'], default: 'client' },
  enabled: { type: Boolean, default: false },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.SsoConfig || mongoose.model('SsoConfig', ssoConfigSchema);
