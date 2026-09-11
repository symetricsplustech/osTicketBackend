/**
 * KnowledgeApproval — approval record for knowledge article lifecycle.
 */
const { Schema, model } = require('mongoose');

const KnowledgeApprovalSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  articleId: { type: Schema.Types.ObjectId, ref: 'Faq', required: true, index: true },
  version: { type: Number },
  approver: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  approverGroup: { type: Schema.Types.ObjectId, ref: 'Group' },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending', index: true },
  decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  decidedAt: { type: Date },
  comment: { type: String, trim: true, default: '' },
  requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  requestedAt: { type: Date, default: Date.now },
  reason: { type: String, trim: true },
  dueAt: { type: Date },
  escalated: { type: Boolean, default: false },
  escalatedAt: { type: Date },
  escalatedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  meta: { type: Schema.Types.Mixed, default: {} },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

KnowledgeApprovalSchema.index({ tenantId: 1, articleId: 1, status: 1, isDeleted: 1 });
KnowledgeApprovalSchema.index({ tenantId: 1, approver: 1, status: 1 });

module.exports = model('KnowledgeApproval', KnowledgeApprovalSchema);
