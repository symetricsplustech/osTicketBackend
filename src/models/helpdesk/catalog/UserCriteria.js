/**
 * UserCriteria — defines who can see or request a catalog item.
 * Supports include/exclude rules for roles, groups, departments, organizations.
 */
const { Schema, model } = require('mongoose');

const UserCriteriaSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  itemId: { type: Schema.Types.ObjectId, ref: 'CatalogItem', required: true, index: true },
  criteriaType: { type: String, enum: ['include', 'exclude'], required: true, index: true },

  // Filter dimensions
  roles: [{ type: Schema.Types.ObjectId, ref: 'Role' }],
  groups: [{ type: Schema.Types.ObjectId, ref: 'Group' }],
  departments: [{ type: Schema.Types.ObjectId, ref: 'Department' }],
  organizations: [{ type: Schema.Types.ObjectId, ref: 'Organization' }],
  users: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  companies: [{ type: Schema.Types.ObjectId, ref: 'Tenant' }],

  // All users match if no specific criteria set
  matchAll: { type: Boolean, default: false },

  // Ordering
  priority: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },

  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

UserCriteriaSchema.index({ tenantId: 1, itemId: 1, criteriaType: 1, isDeleted: 1 });

module.exports = model('UserCriteria', UserCriteriaSchema);
