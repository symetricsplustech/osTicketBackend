const mongoose = require("mongoose");

const bundleSchema = new mongoose.Schema({
  locale: { type: String, required: true, index: true },
  namespace: { type: String, default: "common", index: true },
  key: { type: String, required: true },
  value: { type: String, required: true },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    default: null,
  },
});
const tenantSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
    unique: true,
  },
  defaultLocale: { type: String, default: "en" },
  timezone: { type: String, default: "UTC" },
});
const userSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  locale: { type: String, default: "en" },
  timezone: { type: String, default: "UTC" },
});
module.exports = {
  MessageBundle: mongoose.model("MessageBundle", bundleSchema),
  TenantLocalePreference: mongoose.model(
    "TenantLocalePreference",
    tenantSchema,
  ),
  UserLocalePreference: mongoose.model("UserLocalePreference", userSchema),
};
