const mongoose = require('mongoose');
const OrganizationUnit = require('./OrganizationUnit');

const organizationUnitLabelSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  type: { type: String, enum: OrganizationUnit.UNIT_TYPES, required: true },
  label: { type: String, required: true, trim: true, maxlength: 80 },
}, { timestamps: true });

organizationUnitLabelSchema.index({ company: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('OrganizationUnitLabel', organizationUnitLabelSchema);
