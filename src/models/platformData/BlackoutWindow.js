const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const blackoutWindowSchema = new mongoose.Schema({
  name: { type: String, required: true }, start: Date, end: Date,
  scopeServices: [String], scopeEnvironments: [String],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.BlackoutWindow || mongoose.model('BlackoutWindow', blackoutWindowSchema);
