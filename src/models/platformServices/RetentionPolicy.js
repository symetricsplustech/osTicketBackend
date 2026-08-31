const mongoose = require('mongoose');
const retentionPolicySchema = new mongoose.Schema({
  name: { type: String, required: true }, entityTypes: [String],
  retainDays: Number, action: { type: String, enum: ['archive', 'delete'], default: 'archive' },
  legalHoldOverride: { type: Boolean, default: true },
  lastRunAt: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.RetentionPolicy || mongoose.model('RetentionPolicy', retentionPolicySchema);
