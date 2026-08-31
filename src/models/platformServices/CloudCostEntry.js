const mongoose = require('mongoose');
const cloudCostEntrySchema = new mongoose.Schema({
  cloudAccount: mongoose.Schema.Types.ObjectId, month: { type: String, required: true },
  service: String, amount: Number,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.CloudCostEntry || mongoose.model('CloudCostEntry', cloudCostEntrySchema);
