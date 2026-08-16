const mongoose = require('mongoose');

const entitlementSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    contract: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract', required: true, index: true },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    service: { type: String, default: '' }, // help topic key / category / asset type
    serviceType: { type: String, enum: ['help_topic', 'category', 'asset_type', 'any'], default: 'any' },
    scope: { type: String, enum: ['included', 'paid', 'blocked', 'approval'], default: 'included' },
    limitType: { type: String, enum: ['unlimited', 'count', 'timespan'], default: 'unlimited' },
    limitValue: { type: Number, default: 0 },
    usedCount: { type: Number, default: 0 },
    timespanDays: { type: Number, default: 30 },
    queue: { type: String, default: '' }, // paid support queue / dept override
    slaOverride: { type: mongoose.Schema.Types.ObjectId, ref: 'SlaPlan', default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

entitlementSchema.index({ company: 1, organization: 1, service: 1, isActive: 1 });

module.exports = mongoose.model('Entitlement', entitlementSchema);