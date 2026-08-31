const mongoose = require('mongoose');
const slaPredictionCacheSchema = new mongoose.Schema({
  computedAt: Date, predictions: mongoose.Schema.Types.Mixed,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.SlaPredictionCache || mongoose.model('SlaPredictionCache', slaPredictionCacheSchema);
