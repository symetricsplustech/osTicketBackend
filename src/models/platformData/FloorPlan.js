const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const floorPlanSchema = new mongoose.Schema({
  building: { type: mongoose.Schema.Types.ObjectId, ref: 'Building', required: true },
  floorNumber: Number,
  placements: [{ space: { type: mongoose.Schema.Types.ObjectId, ref: 'Space' }, x: Number, y: Number, w: { type: Number, default: 60 }, h: { type: Number, default: 40 } }],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.FloorPlan || mongoose.model('FloorPlan', floorPlanSchema);
