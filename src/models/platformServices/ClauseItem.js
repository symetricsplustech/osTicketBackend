const mongoose = require('mongoose');
const clauseItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, enum: ['liability', 'termination', 'confidentiality', 'sla', 'payment', 'ip', 'data_protection', 'other'], default: 'other' },
  body: { type: String, required: true },
  riskNotes: String,
  fallbackPosition: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.ClauseItem || mongoose.model('ClauseItem', clauseItemSchema);
