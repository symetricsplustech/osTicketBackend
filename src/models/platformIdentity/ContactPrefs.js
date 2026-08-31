const mongoose = require('mongoose');
const contactPrefsSchema = new mongoose.Schema({
  contact: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
  doNotCall: Boolean, emailOptIn: { type: Boolean, default: true }, whatsappOptIn: Boolean,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.ContactPrefs || mongoose.model('ContactPrefs', contactPrefsSchema);
