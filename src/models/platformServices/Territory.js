const mongoose = require('mongoose');
const territorySchema = new mongoose.Schema({
  name: { type: String, required: true }, regions: [String],
  owner: mongoose.Schema.Types.ObjectId,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.Territory || mongoose.model('Territory', territorySchema);
