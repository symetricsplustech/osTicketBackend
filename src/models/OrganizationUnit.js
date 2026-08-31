const mongoose = require('mongoose');

const UNIT_TYPES = ['organization', 'subsidiary', 'division', 'business_unit', 'department', 'branch', 'location', 'site', 'facility', 'team', 'project', 'cost_centre', 'region', 'territory'];

const organizationUnitSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: UNIT_TYPES, required: true, index: true },
  label: { type: String, default: '' },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'OrganizationUnit', default: null, index: true },
  status: { type: String, enum: ['active', 'disabled'], default: 'active' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });
organizationUnitSchema.index({ company: 1, parent: 1, name: 1 }, { unique: true });

organizationUnitSchema.pre('validate', async function validateHierarchy(next) {
  try {
    if (!this.parent) return next();
    if (this._id && String(this.parent) === String(this._id)) return next(new Error('An organisation unit cannot be its own parent'));
    const OrganizationUnit = this.constructor;
    const visited = new Set(this._id ? [String(this._id)] : []);
    let cursor = await OrganizationUnit.findById(this.parent).select('company parent');
    if (!cursor) return next(new Error('Parent organisation unit not found'));
    if (String(cursor.company) !== String(this.company)) return next(new Error('Parent organisation unit belongs to another tenant'));
    while (cursor) {
      const id = String(cursor._id);
      if (visited.has(id)) return next(new Error('Organisation hierarchy cannot contain a cycle'));
      visited.add(id);
      cursor = cursor.parent ? await OrganizationUnit.findById(cursor.parent).select('company parent') : null;
      if (cursor && String(cursor.company) !== String(this.company)) return next(new Error('Parent organisation unit belongs to another tenant'));
    }
    next();
  } catch (error) { next(error); }
});
organizationUnitSchema.statics.UNIT_TYPES = UNIT_TYPES;
module.exports = mongoose.model('OrganizationUnit', organizationUnitSchema);
