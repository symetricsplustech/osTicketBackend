const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  name: { type: String, required: true, trim: true },
  nameKey: { type: String, required: true, trim: true },
  domain: { type: String, default: "", lowercase: true, trim: true },
  email: { type: String, default: "", lowercase: true, trim: true },
  phone: { type: String, default: "", trim: true },
  address: { type: String, default: "", trim: true },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  isPrimary: { type: Boolean, default: false },
  ownerUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

schema.index({ tenantId: 1, nameKey: 1 }, { unique: true });
schema.index({ tenantId: 1, isPrimary: 1 }, {
  unique: true, partialFilterExpression: { isPrimary: true },
});

module.exports = mongoose.model("InstanceCompany", schema);
