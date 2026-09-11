const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  type: { type: String, required: true },
  label: { type: String, required: true },
}, { timestamps: true });
schema.index({ company: 1, type: 1 }, { unique: true });
module.exports = mongoose.model('OrganizationUnitLabel', schema);
