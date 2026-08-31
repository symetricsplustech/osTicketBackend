const mongoose = require('mongoose');
const ragThresholdSchema = new mongoose.Schema({
  metric: { type: String, required: true, unique: true },
  greenBelow: Number, amberBelow: Number, // above amber => red
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.RagThreshold || mongoose.model('RagThreshold', ragThresholdSchema);
