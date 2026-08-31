const mongoose = require('mongoose');
const oppMetaSchema = new mongoose.Schema({
  opportunity: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', unique: true },
  competitors: [String], stakeholders: [{ name: String, role: String, influence: String }],
  mutualActionPlan: [{ step: String, owner: String, dueDate: Date, done: Boolean }],
  pipelineId: mongoose.Schema.Types.ObjectId,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.OppMeta || mongoose.model('OppMeta', oppMetaSchema);
