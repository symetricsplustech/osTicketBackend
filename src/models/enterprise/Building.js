const mongoose = require('mongoose');
const buildingSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: String,
  floors: [{ number: Number, name: String, planUrl: String }],
  amenities: [String],
  timezone: String,
  capacity: Number,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.Building || mongoose.model('Building', buildingSchema);
