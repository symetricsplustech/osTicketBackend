const mongoose = require('mongoose');
const ldapConfigSchema = new mongoose.Schema({
  url: String,
  bindDn: String,
  bindPassword: String,
  searchBase: String,
  searchFilter: { type: String, default: '(mail={{username}})' },
  attributeMappings: { email: { type: String, default: 'mail' }, name: { type: String, default: 'cn' } },
  enabled: { type: Boolean, default: false },
  lastTestResult: String,
  lastTestedAt: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.LdapConfig || mongoose.model('LdapConfig', ldapConfigSchema);
