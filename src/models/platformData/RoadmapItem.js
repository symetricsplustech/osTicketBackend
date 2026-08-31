const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const roadmapItemSchema = new mongoose.Schema({
  portfolio: mongoose.Schema.Types.ObjectId, project: mongoose.Schema.Types.ObjectId,
  quarter: { type: String, required: true }, theme: String, outcome: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.RoadmapItem || mongoose.model('RoadmapItem', roadmapItemSchema);
