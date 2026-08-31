const mongoose = require('mongoose');
const postImplReviewSchema = new mongoose.Schema({
  change: { type: mongoose.Schema.Types.ObjectId, ref: 'Change', required: true },
  status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
  plannedDate: Date,
  completedDate: Date,
  questions: [{ question: String, answer: String, category: String }],
  lessonsLearned: String,
  riskRating: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  outcome: { type: String, enum: ['successful', 'partially_successful', 'unsuccessful'], default: 'successful' },
  recommendations: [String],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
}, { timestamps: true });
module.exports = mongoose.models.PostImplReview || mongoose.model('PostImplReview', postImplReviewSchema);
