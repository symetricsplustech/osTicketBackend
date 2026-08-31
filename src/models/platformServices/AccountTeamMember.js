const mongoose = require('mongoose');
const accountTeamMemberSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  teamRole: { type: String, enum: ['owner', 'sales_rep', 'engineer', 'support_lead', 'exec_sponsor'], default: 'sales_rep' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.AccountTeamMember || mongoose.model('AccountTeamMember', accountTeamMemberSchema);
