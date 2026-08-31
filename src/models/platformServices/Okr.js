const mongoose = require('mongoose');
const okrSchema = new mongoose.Schema({
  objective: { type: String, required: true },
  owner: mongoose.Schema.Types.ObjectId,
  period: { type: String, default: () => new Date().getFullYear().toString() },
  keyResults: [{ text: String, target: Number, current: { type: Number, default: 0 }, unit: String }],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.Okr || mongoose.model('Okr', okrSchema);
