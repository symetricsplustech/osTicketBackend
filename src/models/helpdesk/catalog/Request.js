/**
 * Request — top-level request header (REQ).
 * Groups multiple requested items from a single order/checkout.
 * States: open, work_in_progress, closed_complete, closed_incomplete, closed_canceled
 */
const { Schema, model } = require('mongoose');

const RequestSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  number: { type: String, required: true, unique: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  status: { type: String, enum: ['open', 'work_in_progress', 'closed_complete', 'closed_incomplete', 'closed_canceled'], default: 'open', index: true },

  // Actors
  requester: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  requestedFor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  openedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  closedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  assignmentGroup: { type: Schema.Types.ObjectId, ref: 'Group' },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },

  // Items
  requestedItems: [{ type: Schema.Types.ObjectId, ref: 'RequestedItem' }],
  itemCount: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0, min: 0 },
  currency: { type: String, default: 'USD' },

  // Approval
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected', 'not_required'], default: 'not_required' },

  // Priority & impact
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  impact: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  urgency: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },

  // Source
  source: { type: String, enum: ['catalog', 'email', 'phone', 'self_service', 'api', 'other'], default: 'catalog' },
  channel: { type: String },

  // SLA
  sla: { type: Schema.Types.ObjectId, ref: 'SLA' },
  dueAt: { type: Date },
  resolvedAt: { type: Date },
  closedAt: { type: Date },

  // Close code
  closeCode: { type: String, enum: ['fulfilled', 'partially_fulfilled', 'incomplete', 'canceled'] },
  closeNotes: { type: String },

  meta: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },

  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

RequestSchema.index({ tenantId: 1, status: 1, isDeleted: 1 });
RequestSchema.index({ tenantId: 1, requester: 1, createdAt: -1 });

module.exports = model('Request', RequestSchema);
