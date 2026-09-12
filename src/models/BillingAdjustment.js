const mongoose = require("mongoose");

const billingAdjustmentSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      default: null,
    },
    amount: { type: Number, required: true },
    reason: { type: String, default: "" },
    status: { type: String, default: "pending" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SuperAdmin",
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("BillingAdjustment", billingAdjustmentSchema);
