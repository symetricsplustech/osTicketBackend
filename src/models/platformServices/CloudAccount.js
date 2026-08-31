const mongoose = require('mongoose');
const cloudAccountSchema = new mongoose.Schema({
  provider: { type: String, enum: ['aws', 'azure', 'gcp'], required: true },
  accountId: String, name: String,
  tagPolicies: [{ key: String, requiredValue: String }],
  monthlyBudget: Number,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.CloudAccount || mongoose.model('CloudAccount', cloudAccountSchema);
