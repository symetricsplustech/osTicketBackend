/**
 * CatalogCategory — logical grouping of catalog items.
 * Each catalog has many categories; each category belongs to one catalog.
 */
const { Schema, model } = require('mongoose');

const CatalogCategorySchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  catalogId: { type: Schema.Types.ObjectId, ref: 'Catalog', required: true, index: true },
  name: { type: String, required: true, trim: true },
  number: { type: String, required: true, unique: true },
  description: { type: String, trim: true, default: '' },
  icon: { type: String, default: 'Folder' },
  parentCategory: { type: Schema.Types.ObjectId, ref: 'CatalogCategory' },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true, index: true },
  visibleInPortal: { type: Boolean, default: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User' },
  meta: { type: Schema.Types.Mixed, default: {} },

  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

CatalogCategorySchema.index({ tenantId: 1, catalogId: 1, isActive: 1, isDeleted: 1 });
CatalogCategorySchema.index({ tenantId: 1, catalogId: 1, name: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

module.exports = model('CatalogCategory', CatalogCategorySchema);
