/**
 * RequestedItem — individual line item in a request (RITM).
 * One RITM per catalog item ordered. Owns the fulfillment lifecycle.
 * States: pending_approval, open, work_in_progress, closed_complete, closed_incomplete, closed_canceled
 */
const { Schema, model } = require('mongoose');

const RequestedItemSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  requestId: { type: Schema.Types.ObjectId, ref: 'Request', required: true, index: true },
  number: { type: String, required: true, unique: true },

  // Source catalog item
  catalogItemId: { type: Schema.Types.ObjectId, ref: 'CatalogItem', required: true, index: true },
  catalogItemName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1, default: 1 },
  unitPrice: { type: Number, default: 0, min: 0 },
  totalPrice: { type: Number, default: 0, min: 0 },
  currency: { type: String, default: 'USD' },

  // Variable answers (form submissions)
  variableAnswers: { type: Schema.Types.Mixed, default: {} },

  // Status
  status: { type: String, enum: ['pending_approval', 'open', 'work_in_progress', 'closed_complete', 'closed_incomplete', 'closed_canceled'], default: 'pending_approval', index: true },

  // Actors
  requestedFor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  assignmentGroup: { type: Schema.Types.ObjectId, ref: 'Group' },
  fulfillmentGroup: { type: Schema.Types.ObjectId, ref: 'Group' },

  // Fulfillment
  fulfillmentPlan: { type: Schema.Types.ObjectId, ref: 'FulfillmentPlan' },
  fulfillmentStatus: { type: String, enum: ['not_started', 'in_progress', 'complete', 'partial', 'failed'], default: 'not_started' },
  fulfillmentStepsTotal: { type: Number, default: 0 },
  fulfillmentStepsComplete: { type: Number, default: 0 },

  // Approval
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected', 'not_required'], default: 'not_required' },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  rejectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  rejectedAt: { type: Date },
  rejectionReason: { type: String },

  // SLA
  sla: { type: Schema.Types.ObjectId, ref: 'SLA' },
  dueAt: { type: Date },
  resolvedAt: { type: Date },
  closedAt: { type: Date },

  // Close
  closeCode: { type: String, enum: ['fulfilled', 'incomplete', 'canceled'] },
  closeNotes: { type: String },
  closedBy: { type: Schema.Types.ObjectId, ref: 'User' },

  // Related entities
  relatedIncidents: [{ type: Schema.Types.ObjectId, ref: 'Incident' }],
  relatedProblems: [{ type: Schema.Types.ObjectId, ref: 'Problem' }],
  relatedChanges: [{ type: Schema.Types.ObjectId, ref: 'Change' }],

  meta: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },

  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

RequestedItemSchema.index({ tenantId: 1, status: 1, isDeleted: 1 });
RequestedItemSchema.index({ tenantId: 1, catalogItemId: 1, createdAt: -1 });

module.exports = model('RequestedItem', RequestedItemSchema);
