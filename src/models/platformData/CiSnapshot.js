const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const ciSnapshotSchema = new mongoose.Schema({
  ci: { type: mongoose.Schema.Types.ObjectId, ref: 'CI', index: true },
  state: mongoose.Schema.Types.Mixed, takenAt: { type: Date, default: Date.now },
  takenBy: oid,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.CiSnapshot || mongoose.model('CiSnapshot', ciSnapshotSchema);
