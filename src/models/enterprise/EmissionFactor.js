const mongoose = require('mongoose');
const emissionFactorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  geography: String,
  year: Number,
  source: String,
  unitInput: String,
  kgCO2ePerUnit: { type: Number, required: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.EmissionFactor || mongoose.model('EmissionFactor', emissionFactorSchema);
