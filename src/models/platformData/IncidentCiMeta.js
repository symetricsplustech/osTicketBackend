const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const incidentCiMetaSchema = new mongoose.Schema({
  incident: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', unique: true },
  cis: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CI' }],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.IncidentCiMeta || mongoose.model('IncidentCiMeta', incidentCiMetaSchema);
