const mongoose = require('mongoose');
const sensorDeviceSchema = new mongoose.Schema({
  space: { type: mongoose.Schema.Types.ObjectId, ref: 'Space', required: true },
  kind: { type: String, enum: ['occupancy', 'temperature', 'co2'], default: 'occupancy' },
  apiKey: { type: String, required: true, unique: true },
  lastSeenAt: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.SensorDevice || mongoose.model('SensorDevice', sensorDeviceSchema);
