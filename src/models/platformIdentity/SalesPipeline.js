const mongoose = require('mongoose');
const salesPipelineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  stages: [{ key: String, probability: Number }],
  isDefault: Boolean,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.SalesPipeline || mongoose.model('SalesPipeline', salesPipelineSchema);
