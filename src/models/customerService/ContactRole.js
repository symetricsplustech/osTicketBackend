const mongoose = require('mongoose');
const contactRoleSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  role: { type: String, enum: ['decision_maker', 'influencer', 'buyer', 'end_user', 'champion', 'gatekeeper', 'other'], required: true },
  title: String,
  department: String,
  isPrimary: { type: Boolean, default: false },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
contactRoleSchema.index({ user: 1, company: 1 });
module.exports = mongoose.models.ContactRole || mongoose.model('ContactRole', contactRoleSchema);
