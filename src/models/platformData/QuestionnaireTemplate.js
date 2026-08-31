const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const questionnaireTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  questions: [{ text: String, weightPct: Number }],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.QuestionnaireTemplate || mongoose.model('QuestionnaireTemplate', questionnaireTemplateSchema);
