const mongoose = require("mongoose");

const privilegedSessionSchema = new mongoose.Schema(
  {
    superAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SuperAdmin",
      required: true,
      index: true,
    },
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    token: { type: String, required: true, unique: true, index: true },
    reason: { type: String, default: "" },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("PrivilegedSession", privilegedSessionSchema);
