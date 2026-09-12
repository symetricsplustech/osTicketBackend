const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", default: null },
    status: { type: String, default: "active" },
    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },
    provider: { type: String, default: "" },
    providerId: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Subscription", subscriptionSchema);
