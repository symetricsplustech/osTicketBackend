const mongoose = require('mongoose');
const spaceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  building: { type: mongoose.Schema.Types.ObjectId, ref: 'Building' },
  floorNumber: Number,
  spaceType: { type: String, enum: ['desk', 'room', 'parking', 'locker', 'amenity'], default: 'desk' },
  capacity: { type: Number, default: 1 },
  equipment: [String],
  accessibility: Boolean,
  reservationRequired: { type: Boolean, default: true },
  approvalRequired: { type: Boolean, default: false },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.Space || mongoose.model('Space', spaceSchema);
