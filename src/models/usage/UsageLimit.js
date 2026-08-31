const mongoose = require('mongoose');
const usageLimitSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
    metric: { type: String, enum: ['apiCalls', 'aiRuns', 'automationRuns', 'storageBytes', 'ticketsCreated', 'webhookDeliveries'], required: true },
    limit: { type: Number, required: true },
    hardBlock: { type: Boolean, default: false }, // if true → 429 when exceeded; else warn-only
    warnAtPct: { type: Number, default: 80 },
    notificationEmail: String,
  },
  { timestamps: true }
);
usageLimitSchema.index({ tenantId: 1, metric: 1 }, { unique: true });
module.exports = mongoose.models.UsageLimit || mongoose.model('UsageLimit', usageLimitSchema);
