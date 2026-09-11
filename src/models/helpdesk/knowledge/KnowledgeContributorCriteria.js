/**
 * KnowledgeContributorCriteria — defines who can EDIT/CONTRIBUTE to a knowledge article.
 */
const { Schema, model } = require('mongoose');

const KnowledgeContributorCriteriaSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  articleId: { type: Schema.Types.ObjectId, ref: 'Faq', required: true, index: true },
  criteriaType: { type: String, enum: ['include', 'exclude'], required: true, index: true },
  roles: [{ type: Schema.Types.ObjectId, ref: 'Role' }],
  groups: [{ type: Schema.Types.ObjectId, ref: 'Group' }],
  departments: [{ type: Schema.Types.ObjectId, ref: 'Department' }],
  organizations: [{ type: Schema.Types.ObjectId, ref: 'Organization' }],
  users: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  companies: [{ type: Schema.Types.ObjectId, ref: 'Tenant' }],
  matchAll: { type: Boolean, default: false },
  priority: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

KnowledgeContributorCriteriaSchema.index({ tenantId: 1, articleId: 1, criteriaType: 1, isDeleted: 1 });

module.exports = model('KnowledgeContributorCriteria', KnowledgeContributorCriteriaSchema);
