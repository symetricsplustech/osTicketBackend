const mongoose = require('mongoose');
const featureFlagSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  enabled: { type: Boolean, default: false },
  type: { type: String, enum: ['boolean', 'percentage', 'user_list', 'tenant_list'], default: 'boolean' },
  percentage: { type: Number, min: 0, max: 100, default: 0 },
  allowedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  allowedTenants: [String],
  deniedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  module: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
}, { timestamps: true });
module.exports = mongoose.models.FeatureFlag || mongoose.model('FeatureFlag', featureFlagSchema);
