const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const ciSourcePrecedenceSchema = new mongoose.Schema({
  ciClass: { type: String, required: true },
  ranking: [{ source: String, rank: Number }],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.CiSourcePrecedence || mongoose.model('CiSourcePrecedence', ciSourcePrecedenceSchema);
