const mongoose = require('mongoose');
const promotionRecordSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fromTitle: String, toTitle: String, effectiveDate: Date,
  compensationDeltaPct: Number,
  downstreamTasks: [{ task: String, done: Boolean }],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.PromotionRecord || mongoose.model('PromotionRecord', promotionRecordSchema);
