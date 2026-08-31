const mongoose = require('mongoose');
const tenantLocalePreferenceSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, unique: true, index: true },
    defaultLocale: { type: String, default: 'en' },
    supportedLocales: { type: [String], default: ['en'] },
    fallbackLocale: { type: String, default: 'en' },
    timezone: { type: String, default: 'UTC' },
  },
  { timestamps: true }
);
module.exports = mongoose.models.TenantLocalePreference || mongoose.model('TenantLocalePreference', tenantLocalePreferenceSchema);
