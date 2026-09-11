/**
 * CatalogEntitlement — maps contract entitlements to catalog items.
 * Determines which items a user/organization is entitled to request.
 */
const { Schema, model } = require('mongoose');

const CatalogEntitlementSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  catalogItemId: { type: Schema.Types.ObjectId, ref: 'CatalogItem', required: true, index: true },
  entitlementId: { type: Schema.Types.ObjectId, ref: 'Entitlement', required: true, index: true },

  // Scope
  scopeType: { type: String, enum: ['user', 'group', 'department', 'organization', 'role', 'company'], required: true, index: true },
  scopeId: { type: Schema.Types.ObjectId, required: true },

  // Limits
  maxQuantity: { type: Number, min: 1 },
  maxRequests: { type: Number, min: 0 },
  requestCount: { type: Number, default: 0 },
  windowDays: { type: Number, min: 1 },

  // Status
  isActive: { type: Boolean, default: true },
  validFrom: { type: Date },
  validTo: { type: Date },

  meta: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },

  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

CatalogEntitlementSchema.index({ tenantId: 1, catalogItemId: 1, scopeType: 1, scopeId: 1, isDeleted: 1 });
CatalogEntitlementSchema.index({ tenantId: 1, entitlementId: 1 });

module.exports = model('CatalogEntitlement', CatalogEntitlementSchema);
