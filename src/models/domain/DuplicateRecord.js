const mongoose = require('mongoose');
const duplicateRecordSchema = new mongoose.Schema({
  entityType: { type: String, enum: ['lead', 'contact', 'account', 'ticket'], required: true },
  primary: { type: mongoose.Schema.Types.ObjectId, required: true },
  duplicate: { type: mongoose.Schema.Types.ObjectId, required: true },
  similarity: { type: Number, min: 0, max: 100 },
  matchedFields: [String],
  status: { type: String, enum: ['pending', 'merged', 'dismissed'], default: 'pending' },
  mergedAt: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.DuplicateRecord || mongoose.model('DuplicateRecord', duplicateRecordSchema);
