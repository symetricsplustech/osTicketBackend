const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, default: '', lowercase: true, trim: true },
    domain: { type: String, default: '', lowercase: true, trim: true },
    logo: { type: String, default: '' },
    address: { type: String, default: '' },
    contactPerson: { type: String, default: '' },
    phone: { type: String, default: '' },
    status: {
      type: String,
      enum: ['trial', 'active', 'suspended', 'expired', 'archived'],
      default: 'trial',
      index: true,
    },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', default: null },
    planStartedAt: { type: Date, default: null },
    planExpiresAt: { type: Date, default: null },
    billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    trialEndsAt: { type: Date, default: null },
    autoRenew: { type: Boolean, default: true },
    storageUsed: { type: Number, default: 0 },
    apiKey: { type: String, default: '' },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin', default: null },
  },
  { timestamps: true }
);

companySchema.methods.isActive = function () {
  return this.status === 'active' || this.status === 'trial';
};

module.exports = mongoose.model('Company', companySchema);
