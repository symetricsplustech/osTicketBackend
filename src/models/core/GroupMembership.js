const mongoose = require("mongoose");

const groupMembershipSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["member", "lead", "manager"],
      default: "member",
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    effectiveFrom: { type: Date, default: Date.now },
    effectiveUntil: { type: Date, default: null },
  },
  { timestamps: true },
);

groupMembershipSchema.index(
  { tenantId: 1, groupId: 1, userId: 1 },
  { unique: true },
);

module.exports = mongoose.model("GroupMembership", groupMembershipSchema);
