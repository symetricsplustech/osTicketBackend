const mongoose = require('mongoose');
const quoteVersionSchema = new mongoose.Schema({
  quote: { type: mongoose.Schema.Types.ObjectId, ref: 'Quote', index: true },
  version: Number, snapshot: mongoose.Schema.Types.Mixed,
  createdBy: mongoose.Schema.Types.ObjectId,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.QuoteVersion || mongoose.model('QuoteVersion', quoteVersionSchema);
