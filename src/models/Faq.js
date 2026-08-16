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
    // ---- Enterprise: Knowledge lifecycle ----
    lifecycle: {
      type: String,
      enum: ['draft', 'review', 'approved', 'published', 'expired', 'archived'],
      default: 'published',
    },
    expiresAt: { type: Date, default: null },
    internalOnly: { type: Boolean, default: false },
    locale: { type: String, default: '' },
    relatedTickets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' }],
    relatedProducts: { type: [String], default: [] },
    analytics: {
      searches: { type: Number, default: 0 },
      lastViewAt: { type: Date, default: null },
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

faqSchema.index({ question: 'text', answer: 'text', keywords: 'text' });

module.exports = mongoose.model('Faq', faqSchema);
