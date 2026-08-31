const mongoose = require('mongoose');
const fiveWhysSchema = new mongoose.Schema({
  problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true },
  whys: [{ q: String, a: String }],
  rootCauseConclusion: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.FiveWhys || mongoose.model('FiveWhys', fiveWhysSchema);
