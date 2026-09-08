const mongoose = require('mongoose');

const platformResourceSchema = new mongoose.Schema({
  kind: {
    type: String,
    required: true,
    enum: ['integration', 'email_domain', 'storage_policy', 'backup', 'disaster_recovery', 'compliance_policy', 'support_incident', 'announcement', 'abuse_case', 'api_key', 'license', 'migration', 'feature_flag'],
    index: true,
  },
  name: { type: String, required: true, trim: true },
  status: { type: String, default: 'active', index: true },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', default: null },
  region: { type: String, default: '', index: true },
  description: { type: String, default: '' },
  config: { type: mongoose.Schema.Types.Mixed, default: {} },
  scopes: { type: [String], default: [] },
  environments: { type: [String], default: [] },
  rolloutPercentage: { type: Number, min: 0, max: 100, default: 100 },
  startsAt: { type: Date, default: null },
  endsAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null },
  lastRunAt: { type: Date, default: null },
  lastResult: { type: mongoose.Schema.Types.Mixed, default: null },
  secretHash: { type: String, select: false, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin', required: true },
}, { timestamps: true });

platformResourceSchema.index({ kind: 1, name: 1, tenant: 1 }, { unique: true });
platformResourceSchema.index({ kind: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('PlatformResource', platformResourceSchema);
