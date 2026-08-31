const mongoose = require('mongoose');
const localeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true }, // e.g. 'en', 'ar', 'fr'
    name: { type: String, required: true }, // e.g. 'English'
    nativeName: { type: String, default: '' },
    direction: { type: String, enum: ['ltr', 'rtl'], default: 'ltr' },
    dateFormat: { type: String, default: 'MM/DD/YYYY' },
    timeFormat: { type: String, enum: ['12h', '24h'], default: '24h' },
    numberLocale: { type: String, default: 'en-US' },
    currency: { type: String, default: 'USD' },
    enabled: { type: Boolean, default: false },
    completeness: { type: Number, default: 0 }, // 0-100 translation %
    tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  },
  { timestamps: true }
);
module.exports = mongoose.models.Locale || mongoose.model('Locale', localeSchema);
