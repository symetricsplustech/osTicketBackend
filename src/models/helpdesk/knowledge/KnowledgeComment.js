/**
 * KnowledgeComment — threaded comments on knowledge articles.
 */
const { Schema, model } = require('mongoose');

const KnowledgeCommentSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  articleId: { type: Schema.Types.ObjectId, ref: 'Faq', required: true, index: true },
  parentId: { type: Schema.Types.ObjectId, ref: 'KnowledgeComment' },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  content: { type: String, required: true, trim: true },
  isInternal: { type: Boolean, default: false, index: true },
  isResolved: { type: Boolean, default: false },
  status: { type: String, enum: ['visible', 'hidden', 'flagged'], default: 'visible', index: true },
  moderatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  moderatedAt: { type: Date },
  moderationReason: { type: String },
  reactions: [{ userId: { type: Schema.Types.ObjectId, ref: 'User' }, type: { type: String, enum: ['like', 'helpful', 'agree', 'disagree'] }, createdAt: { type: Date, default: Date.now } }],
  meta: { type: Schema.Types.Mixed, default: {} },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

KnowledgeCommentSchema.index({ tenantId: 1, articleId: 1, status: 1, isDeleted: 1 });

module.exports = model('KnowledgeComment', KnowledgeCommentSchema);
