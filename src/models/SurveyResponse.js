const mongoose = require('mongoose');

const surveyResponseSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    survey: { type: mongoose.Schema.Types.ObjectId, ref: 'Survey', required: true, index: true },
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', default: null },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null, index: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    rating: { type: Number, required: true },
    comment: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    respondedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

surveyResponseSchema.index({ company: 1, survey: 1, respondedAt: -1 });
surveyResponseSchema.index({ ticket: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('SurveyResponse', surveyResponseSchema);
