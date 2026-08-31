const mongoose = require('mongoose');
const customRecordSchema = new mongoose.Schema({
  table: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomTable', required: true, index: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
}, { timestamps: true });
module.exports = mongoose.models.CustomRecord || mongoose.model('CustomRecord', customRecordSchema);
