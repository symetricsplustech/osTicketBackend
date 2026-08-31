const mongoose = require('mongoose');
const woGeoSchema = new mongoose.Schema({
  workOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder', unique: true },
  lat: Number, lng: Number, geofenceRadiusM: { type: Number, default: 150 },
  checkedInLat: Number, checkedInLng: Number,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.WoGeo || mongoose.model('WoGeo', woGeoSchema);
