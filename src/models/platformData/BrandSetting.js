const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const brandSettingSchema = new mongoose.Schema({
  logoUrl: String, faviconUrl: String, primaryColor: String,
  loginHeadline: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, unique: true, sparse: true },
}, { timestamps: true });
module.exports = mongoose.models.BrandSetting || mongoose.model('BrandSetting', brandSettingSchema);
