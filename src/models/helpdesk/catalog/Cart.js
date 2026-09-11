/**
 * Cart — user's shopping cart for catalog items.
 * One active cart per user per tenant.
 */
const { Schema, model } = require('mongoose');

const CartSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  number: { type: String, required: true, unique: true },
  status: { type: String, enum: ['active', 'submitted', 'abandoned'], default: 'active', index: true },
  items: [{ type: Schema.Types.ObjectId, ref: 'CartItem' }],
  totalItems: { type: Number, default: 0 },
  totalPrice: { type: Number, default: 0, min: 0 },
  currency: { type: String, default: 'USD' },

  // Checkout context
  requestedFor: { type: Schema.Types.ObjectId, ref: 'User' },
  deliveryAddress: { type: String },
  specialInstructions: { type: String },

  submittedAt: { type: Date },
  submittedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  abandonedAt: { type: Date },
  abandonedReason: { type: String },

  meta: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },

  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

CartSchema.index({ tenantId: 1, userId: 1, status: 1, isDeleted: 1 });

module.exports = model('Cart', CartSchema);
