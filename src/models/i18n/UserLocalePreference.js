const mongoose = require('mongoose');
const userLocalePreferenceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, unique: true, index: true },
    locale: { type: String, default: 'en' },
    timezone: { type: String, default: 'UTC' },
    tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  },
  { timestamps: true }
);
module.exports = mongoose.models.UserLocalePreference || mongoose.model('UserLocalePreference', userLocalePreferenceSchema);
