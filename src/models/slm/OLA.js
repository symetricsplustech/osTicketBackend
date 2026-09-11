/**
 * OLA — Operational Level Agreement.
 * Internal SLA between teams/groups within the organization.
 * Linked to an SLA plan and a specific team/department.
 */
const { Schema, model } = require('mongoose');

const OLASchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  number: { type: String, required: true, unique: true },
  description: { type: String, trim: true, default: '' },

  // Linked SLA plan (inherits targets from this)
  slaPlanId: { type: Schema.Types.ObjectId, ref: 'SlaPlan', required: true, index: true },

  // Scope
  department: { type: Schema.Types.ObjectId, ref: 'Department', index: true },
  group: { type: Schema.Types.ObjectId, ref: 'Group', index: true },
  service: { type: Schema.Types.ObjectId, ref: 'ServiceCatalogItem' },

  // Targets (override SLA plan targets if set)
  targets: {
    response: { type: Number },  // hours
    resolution: { type: Number }, // hours
    update: { type: Number },     // hours between updates
  },

  // Schedule
  schedule: { type: String, enum: ['24/7', 'business_hours', 'custom'], default: 'business_hours' },
  timezone: { type: String, default: 'UTC' },

  // Status
  isActive: { type: Boolean, default: true, index: true },
  status: { type: String, enum: ['active', 'inactive', 'draft'], default: 'draft' },

  // Metrics
  totalTickets: { type: Number, default: 0 },
  breachedTickets: { type: Number, default: 0 },
  metTickets: { type: Number, default: 0 },
  complianceRate: { type: Number, default: 0, min: 0, max: 100 },

  meta: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },

  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

OLASchema.index({ tenantId: 1, isActive: 1, isDeleted: 1 });
OLASchema.index({ tenantId: 1, department: 1, isActive: 1 });

module.exports = model('OLA', OLASchema);
