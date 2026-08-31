const mongoose = require('mongoose');
const grcQuestionnaireSchema = new mongoose.Schema({
  name: { type: String, required: true },
  questions: [{ text: String, weightPct: Number, evidenceRequired: Boolean }],
  assignedThirdParties: [mongoose.Schema.Types.ObjectId],
  responses: [{ thirdParty: mongoose.Schema.Types.ObjectId, answers: mongoose.Schema.Types.Mixed, score: Number }],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.GrcQuestionnaire || mongoose.model('GrcQuestionnaire', grcQuestionnaireSchema);
