const mongoose = require('mongoose');
const orgMembershipSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  role: { type: String, default: 'member' },
  isDefault: Boolean,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
orgMembershipSchema.index({ user: 1, organization: 1 }, { unique: true });
module.exports = mongoose.models.OrgMembership || mongoose.model('OrgMembership', orgMembershipSchema);
