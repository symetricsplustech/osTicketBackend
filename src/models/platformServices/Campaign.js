const mongoose = require('mongoose');
const campaignSchema = new mongoose.Schema({
  name: { type: String, required: true }, channel: { type: String, enum: ['email', 'ads', 'event', 'referral', 'outbound'], default: 'email' },
  budget: Number, status: { type: String, enum: ['draft', 'active', 'completed'], default: 'draft' },
  members: [{ contact: mongoose.Schema.Types.ObjectId, status: { type: String, enum: ['sent', 'opened', 'responded', 'converted'], default: 'sent' }, at: Date }],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.Campaign || mongoose.model('Campaign', campaignSchema);
