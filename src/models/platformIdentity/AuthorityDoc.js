const mongoose = require('mongoose');
const authorityDocSchema = new mongoose.Schema({
  code: { type: String, required: true }, title: String,
  jurisdiction: String,
  citations: [{ clause: String, summary: String }],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.AuthorityDoc || mongoose.model('AuthorityDoc', authorityDocSchema);
