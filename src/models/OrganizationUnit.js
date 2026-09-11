const mongoose = require('mongoose');
const UNIT_TYPES = ['division', 'department', 'team', 'location'];
const schema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'OrganizationUnit', default: null },
  type: { type: String, enum: UNIT_TYPES, required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  active: { type: Boolean, default: true },
}, { timestamps: true });
schema.statics.UNIT_TYPES = UNIT_TYPES;
module.exports = mongoose.model('OrganizationUnit', schema);
