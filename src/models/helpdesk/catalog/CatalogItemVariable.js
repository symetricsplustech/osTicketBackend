/**
 * CatalogItemVariable — variable/field definition for a catalog item.
 * Supports text, number, select, checkbox, date, reference, and lookup types.
 */
const { Schema, model } = require('mongoose');

const CatalogItemVariableSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  itemId: { type: Schema.Types.ObjectId, ref: 'CatalogItem', required: true, index: true },
  variableSetId: { type: Schema.Types.ObjectId, ref: 'VariableSet' },
  name: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true },
  type: {
    type: String, required: true, index: true,
    enum: ['string', 'integer', 'decimal', 'boolean', 'select', 'multi_select',
           'date', 'datetime', 'reference', 'lookup', 'email', 'url', 'phone',
           'glide_date', 'glide_date_time', 'attachment', 'password', 'script', 'container'],
  },
  defaultValue: { type: Schema.Types.Mixed },
  value: { type: Schema.Types.Mixed },
  helpText: { type: String, trim: true, default: '' },
  placeholder: { type: String, trim: true, default: '' },
  required: { type: Boolean, default: false },
  readOnly: { type: Boolean, default: false },
  visible: { type: Boolean, default: true },
  maxLength: { type: Number },
  minLength: { type: Number },
  regex: { type: String },
  regexError: { type: String },
  choices: [{
    label: { type: String, required: true },
    value: { type: String, required: true },
    order: { type: Number, default: 0 },
    inactive: { type: Boolean, default: false },
    dependentValue: { type: String },
  }],
  referenceModel: { type: String },
  referenceQual: { type: String },
  lookupField: { type: String },
  dependentVariable: { type: String },
  sortOrder: { type: Number, default: 0 },
  section: { type: String, default: 'default' },
  meta: { type: Schema.Types.Mixed, default: {} },

  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

CatalogItemVariableSchema.index({ tenantId: 1, itemId: 1, sortOrder: 1, isDeleted: 1 });

module.exports = model('CatalogItemVariable', CatalogItemVariableSchema);
