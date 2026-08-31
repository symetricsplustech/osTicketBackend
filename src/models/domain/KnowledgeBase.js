const mongoose = require('mongoose');
const knowledgeBaseSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  description: String,
  visibility: { type: String, enum: ['public', 'internal', 'agents_only'], default: 'public' },
  departments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
  articleCount: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.KnowledgeBase || mongoose.model('KnowledgeBase', knowledgeBaseSchema);
