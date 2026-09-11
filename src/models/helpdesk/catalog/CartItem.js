/**
 * CartItem — individual line item in a cart.
 */
const { Schema, model } = require('mongoose');

const CartItemSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  cartId: { type: Schema.Types.ObjectId, ref: 'Cart', required: true, index: true },
  catalogItemId: { type: Schema.Types.ObjectId, ref: 'CatalogItem', required: true, index: true },
  quantity: { type: Number, required: true, min: 1, default: 1 },
  unitPrice: { type: Number, default: 0, min: 0 },
  totalPrice: { type: Number, default: 0, min: 0 },
  currency: { type: String, default: 'USD' },
  variableAnswers: { type: Schema.Types.Mixed, default: {} },
  specialInstructions: { type: String },
  gift: { type: Boolean, default: false },
  giftMessage: { type: String },

  meta: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },

  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

CartItemSchema.index({ tenantId: 1, cartId: 1, isDeleted: 1 });
CartItemSchema.index({ tenantId: 1, catalogItemId: 1 });

module.exports = model('CartItem', CartItemSchema);
