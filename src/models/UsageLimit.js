const mongoose = require("mongoose");
const limitSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
    index: true,
  },
  metric: { type: String, required: true },
  limit: { type: Number, required: true },
  hardBlock: { type: Boolean, default: false },
  warnAtPct: { type: Number, default: 80 },
});
const meterSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
    index: true,
  },
  period: { type: String, required: true },
  apiCalls: { type: Number, default: 0 },
  storageBytes: { type: Number, default: 0 },
  agents: { type: Number, default: 0 },
  users: { type: Number, default: 0 },
  tickets: { type: Number, default: 0 },
});
meterSchema.index({ tenantId: 1, period: 1 }, { unique: true });
module.exports = {
  UsageLimit: mongoose.model("UsageLimit", limitSchema),
  UsageMeter: mongoose.model("UsageMeter", meterSchema),
};
