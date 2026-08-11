const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema(
  {
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'FaqCategory', default: null },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true },
    keywords: { type: [String], default: [] },
    isPublished: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    views: { type: Number, default: 0 },
    helpful: { type: Number, default: 0 },
    notHelpful: { type: Number, default: 0 },
  },
  { timestamps: true }
);

faqSchema.index({ question: 'text', answer: 'text', keywords: 'text' });

module.exports = mongoose.model('Faq', faqSchema);
