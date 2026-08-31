const mongoose = require('mongoose');
const firstTimeFixMetaSchema = new mongoose.Schema({
  workOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder', unique: true },
  firstTimeFix: Boolean, returnVisitReason: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.FirstTimeFixMeta || mongoose.model('FirstTimeFixMeta', firstTimeFixMetaSchema);
