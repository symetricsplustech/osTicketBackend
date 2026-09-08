const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, unique: true, index: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
  status: { type: String, enum: ['trialing', 'active', 'past_due', 'grace', 'paused', 'cancelled', 'expired'], default: 'trialing', index: true },
  billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  trialEndsAt: Date,
  graceEndsAt: Date,
  cancelAtPeriodEnd: { type: Boolean, default: false },
  cancelledAt: Date,
  cancellationReason: { type: String, default: '' },
  scheduledPlan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', default: null },
  scheduledChangeAt: Date,
  renewalAttempts: { type: Number, default: 0 },
  lastPaymentFailure: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
