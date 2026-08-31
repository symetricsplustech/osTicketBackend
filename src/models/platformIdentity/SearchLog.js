const mongoose = require('mongoose');
const searchLogSchema = new mongoose.Schema({
  query: String, resultCount: Number, userId: mongoose.Schema.Types.ObjectId,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.SearchLog || mongoose.model('SearchLog', searchLogSchema);
