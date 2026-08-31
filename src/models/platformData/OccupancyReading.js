const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const occupancyReadingSchema = new mongoose.Schema({
  space: { type: mongoose.Schema.Types.ObjectId, ref: 'Space', index: true },
  count: Number, capacity: Number,
  at: { type: Date, default: Date.now },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.OccupancyReading || mongoose.model('OccupancyReading', occupancyReadingSchema);
