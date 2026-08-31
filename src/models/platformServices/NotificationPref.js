const mongoose = require('mongoose');
const notificationPrefSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
  channels: { inApp: { type: Boolean, default: true }, email: { type: Boolean, default: true }, push: { type: Boolean, default: false }, sms: { type: Boolean, default: false } },
  quietHours: { enabled: Boolean, start: String, end: String, tz: String },
  digest: { type: String, enum: ['off', 'daily', 'weekly'], default: 'off' },
}, { timestamps: true });
module.exports = mongoose.models.NotificationPref || mongoose.model('NotificationPref', notificationPrefSchema);
