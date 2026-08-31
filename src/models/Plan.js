const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, default: '' },
    priceMonthly: { type: Number, default: 0 },
    priceYearly: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    maxAgents: { type: Number, default: 5 },
    maxUsers: { type: Number, default: 100 },
    maxContacts: { type: Number, default: 0 },
    maxTickets: { type: Number, default: 0 },
    storageLimit: { type: Number, default: 5 * 1024 * 1024 * 1024 },
    apiRateLimit: { type: Number, default: 1000 },
    apiMonthlyLimit: { type: Number, default: 100000 },
    monthlyUsageLimit: { type: Number, default: 0 },
    features: { type: [String], default: [] },
    moduleKeys: { type: [String], default: [] },
    apiAccess: { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false },
    trialDays: { type: Number, default: 14 },
    gracePeriodDays: { type: Number, default: 7 },
    subscriptionRestrictions: { type: mongoose.Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Plan', planSchema);
