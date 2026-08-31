const mongoose = require('mongoose');
const deviceSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  device: String,
  browser: String,
  os: String,
  ip: String,
  lastActive: { type: Date, default: Date.now },
  token: String,
  status: { type: String, enum: ['active', 'expired', 'revoked'], default: 'active' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.DeviceSession || mongoose.model('DeviceSession', deviceSessionSchema);
