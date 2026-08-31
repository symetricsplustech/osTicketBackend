const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const classificationTagSchema = new mongoose.Schema({
  entity: String, entityId: mongoose.Schema.Types.ObjectId,
  label: { type: String, enum: ['public', 'internal', 'confidential', 'restricted', 'pii'], default: 'internal' },
  taggedBy: oid,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.ClassificationTag || mongoose.model('ClassificationTag', classificationTagSchema);
