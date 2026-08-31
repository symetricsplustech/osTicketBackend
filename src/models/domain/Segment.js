const mongoose = require('mongoose');
const segmentSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  description: String,
  type: { type: String, enum: ['dynamic', 'static'], default: 'dynamic' },
  rules: [{ field: String, operator: String, value: String }],
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  memberCount: { type: Number, default: 0 },
  lastCalculated: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.Segment || mongoose.model('Segment', segmentSchema);
