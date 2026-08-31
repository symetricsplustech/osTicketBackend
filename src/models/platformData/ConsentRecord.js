const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const consentRecordSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, subjectEmail: String,
  consentType: { type: String, enum: ['marketing', 'processing', 'cookies', 'whatsapp'], required: true },
  granted: Boolean, textVersion: String, ip: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.ConsentRecord || mongoose.model('ConsentRecord', consentRecordSchema);
