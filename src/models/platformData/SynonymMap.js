const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const synonymMapSchema = new mongoose.Schema({
  term: { type: String, required: true }, synonyms: [String],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.SynonymMap || mongoose.model('SynonymMap', synonymMapSchema);
