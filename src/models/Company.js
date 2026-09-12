const mongoose = require("mongoose");

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, default: "", lowercase: true, trim: true },
    // Per-organisation inbound support inbox. Customers mail THIS address to
    // create/track tickets without logging in. Falls back to `email` when empty.
    supportEmail: { type: String, default: "", lowercase: true, trim: true },
    domain: { type: String, default: "", lowercase: true, trim: true },
    logo: { type: String, default: "" },
    address: { type: String, default: "" },
    contactPerson: { type: String, default: "" },
    phone: { type: String, default: "" },
    status: {
      type: String,
      enum: [
        "pending_verification",
        "trial",
        "active",
        "grace",
        "restricted",
        "suspended",
        "expired",
        "archived",
        "terminated",
      ],
      default: "trial",
      index: true,
    },
    // Company owner (tenant owner agent) + self-registration verification.
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      default: null,
    },
    verificationToken: { type: String, default: null },
    verificationExpires: { type: Date, default: null },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", default: null },
    planStartedAt: { type: Date, default: null },
    planExpiresAt: { type: Date, default: null },
    billingCycle: {
      type: String,
      enum: ["monthly", "yearly"],
      default: "monthly",
    },
    trialEndsAt: { type: Date, default: null },
    autoRenew: { type: Boolean, default: true },
    statusReason: { type: String, default: "" },
    graceEndsAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    terminatedAt: { type: Date, default: null },
    purgeScheduledAt: { type: Date, default: null },
    legalHold: { type: Boolean, default: false },
    lifecycleHistory: [
      {
        status: String,
        reason: String,
        actor: { type: mongoose.Schema.Types.ObjectId, ref: "SuperAdmin" },
        at: { type: Date, default: Date.now },
      },
    ],
    storageUsed: { type: Number, default: 0 },
    apiKey: { type: String, default: "" },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SuperAdmin",
      default: null,
    },
  },
  { timestamps: true },
);

companySchema.methods.isActive = function () {
  return this.status === "active" || this.status === "trial";
};

module.exports = mongoose.model("Company", companySchema);
