/**
 * Catalog — top-level service catalog container.
 * One global catalog per tenant or a single global catalog.
 */
const { Schema, model } = require("mongoose");

const CatalogSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    number: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    icon: { type: String, default: "FolderOpen" },
    isActive: { type: Boolean, default: true, index: true },
    visibleInPortal: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    owner: { type: Schema.Types.ObjectId, ref: "User" },
    parentCatalog: { type: Schema.Types.ObjectId, ref: "Catalog" },
    meta: { type: Schema.Types.Mixed, default: {} },

    // Soft delete
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

CatalogSchema.index({ tenantId: 1, isActive: 1, isDeleted: 1 });
CatalogSchema.index(
  { tenantId: 1, name: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);

module.exports = model("Catalog", CatalogSchema);
