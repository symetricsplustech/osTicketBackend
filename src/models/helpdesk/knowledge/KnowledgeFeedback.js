/**
 * KnowledgeFeedback — user feedback on knowledge articles.
 * Captures structured feedback beyond simple helpful/notHelpful.
 */
const { Schema, model } = require('mongoose');

const KnowledgeFeedbackSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  articleId: { type: Schema.Types.ObjectId, ref: 'Faq', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  // Feedback type
  type: { type: String, enum: ['helpful', 'not_helpful', 'outdated', 'incorrect', 'incomplete', 'unclear', 'suggestion'], required: true, index: true },
  rating: { type: Number, min: 1, max: 5 },

  // Comment
  comment: { type: String, trim: true, default: '' },
  isPublic: { type: Boolean, default: true },

  // Context
  source: { type: String, enum: ['article_view', 'ticket_deflection', 'search', 'other'], default: 'article_view' },
  ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket' },

  // Response
  respondedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  respondedAt: { type: Date },
  response: { type: String, trim: true },
  responseAction: { type: String, enum: ['acknowledged', 'addressed', 'article_updated', 'no_action'] },

  meta: { type: Schema.Types.Mixed, default: {} },

  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

KnowledgeFeedbackSchema.index({ tenantId: 1, articleId: 1, type: 1, isDeleted: 1 });
KnowledgeFeedbackSchema.index({ tenantId: 1, userId: 1, articleId: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

module.exports = model('KnowledgeFeedback', KnowledgeFeedbackSchema);
