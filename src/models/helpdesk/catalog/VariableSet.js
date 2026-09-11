/**
 * VariableSet — reusable collection of variables shared across catalog items.
 */
const { Schema, model } = require('mongoose');

const VariableSetSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  number: { type: String, required: true, unique: true },
  description: { type: String, trim: true, default: '' },
  isActive: { type: Boolean, default: true },
  items: [{ type: Schema.Types.ObjectId, ref: 'CatalogItem' }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },

  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

VariableSetSchema.index({ tenantId: 1, isActive: 1, isDeleted: 1 });

module.exports = model('VariableSet', VariableSetSchema);
