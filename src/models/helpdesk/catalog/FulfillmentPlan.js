/**
 * FulfillmentPlan — template for fulfilling a catalog item.
 * Defines the ordered steps required to fulfill an order.
 */
const { Schema, model } = require('mongoose');

const FulfillmentPlanSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  number: { type: String, required: true, unique: true },
  description: { type: String, trim: true, default: '' },
  isActive: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false },

  // Linked catalog items
  catalogItems: [{ type: Schema.Types.ObjectId, ref: 'CatalogItem' }],

  // Steps in this plan
  steps: [{ type: Schema.Types.ObjectId, ref: 'FulfillmentStep' }],
  stepCount: { type: Number, default: 0 },

  // Default assignment
  defaultAssignmentGroup: { type: Schema.Types.ObjectId, ref: 'Group' },
  defaultTeam: { type: Schema.Types.ObjectId, ref: 'Team' },

  meta: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },

  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

FulfillmentPlanSchema.index({ tenantId: 1, isActive: 1, isDeleted: 1 });

module.exports = model('FulfillmentPlan', FulfillmentPlanSchema);
