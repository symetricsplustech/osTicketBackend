const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
  survey: { type: mongoose.Schema.Types.ObjectId, ref: 'Survey', required: true },
  ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', default: null },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  rating: { type: Number, required: true },
  comment: { type: String, default: '' },
  respondedAt: { type: Date, default: Date.now },
}, { timestamps: true });
module.exports = mongoose.model('SurveyResponse', schema);
