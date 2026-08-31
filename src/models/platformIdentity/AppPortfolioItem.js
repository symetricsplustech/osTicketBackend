const mongoose = require('mongoose');
const appPortfolioItemSchema = new mongoose.Schema({
  appName: { type: String, required: true },
  tier: { type: String, enum: ['tier_1', 'tier_2', 'tier_3'], default: 'tier_2' },
  lifecycleStage: { type: String, enum: ['invest', 'build', 'maintain', 'sunset'], default: 'maintain' },
  businessValue: Number, technicalFit: Number,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.AppPortfolioItem || mongoose.model('AppPortfolioItem', appPortfolioItemSchema);
