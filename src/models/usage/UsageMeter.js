const mongoose = require('mongoose');
const usageMeterSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
    period: { type: String, index: true }, // 'YYYY-MM'
    apiCalls: { type: Number, default: 0 },
    aiRuns: { type: Number, default: 0 },
    automationRuns: { type: Number, default: 0 },
    storageBytes: { type: Number, default: 0 },
    ticketsCreated: { type: Number, default: 0 },
    webhookDeliveries: { type: Number, default: 0 },
  },
  { timestamps: true }
);
usageMeterSchema.index({ tenantId: 1, period: 1 }, { unique: true });
module.exports = mongoose.models.UsageMeter || mongoose.model('UsageMeter', usageMeterSchema);
