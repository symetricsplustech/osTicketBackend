const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  instance: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  role: { type: String, enum: ["instance_admin", "agent", "requester"], required: true },
  permissions: { type: [String], default: [] },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  acceptedAt: { type: Date, default: null },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model("InstanceInvitation", schema);
