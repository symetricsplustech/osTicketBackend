/**
 * ItemApproval — individual approval record for a requested item.
 * Tracks one approver's decision within an approval chain.
 */
const { Schema, model } = require('mongoose');

const ItemApprovalSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  requestedItemId: { type: Schema.Types.ObjectId, ref: 'RequestedItem', required: true, index: true },
  requestId: { type: Schema.Types.ObjectId, ref: 'Request', required: true, index: true },
  approvalId: { type: Schema.Types.ObjectId, ref: 'RequestApproval', index: true },

  // Approver
  approver: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  approverGroup: { type: Schema.Types.ObjectId, ref: 'Group' },
  type: { type: String, enum: ['individual', 'group', 'sequential', 'parallel'], default: 'individual' },

  // Decision
  state: { type: String, enum: ['pending', 'approved', 'rejected', 'skipped', 'expired', 'delegated'], default: 'pending', index: true },
  decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  decidedAt: { type: Date },
  comment: { type: String },

  // Delegation
  delegatedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  delegationNote: { type: String },

  // Escalation
  escalationLevel: { type: Number, default: 0 },
  dueAt: { type: Date },
  escalated: { type: Boolean, default: false },
  escalatedAt: { type: Date },
  escalatedTo: { type: Schema.Types.ObjectId, ref: 'User' },

  meta: { type: Schema.Types.Mixed, default: {} },

  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

ItemApprovalSchema.index({ tenantId: 1, requestedItemId: 1, state: 1, isDeleted: 1 });
ItemApprovalSchema.index({ tenantId: 1, approver: 1, state: 1 });

module.exports = model('ItemApproval', ItemApprovalSchema);
