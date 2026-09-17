const mongoose = require("mongoose");
const schema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    instanceCompany: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InstanceCompany",
      default: null,
      index: true,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrganizationUnit",
      default: null,
    },
    // Types are tenant-owned records in OrganizationUnitLabel, not an enum.
    type: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    label: { type: String, default: "", trim: true },
    description: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    active: { type: Boolean, default: true },
    status: { type: String, enum: ["active", "disabled"], default: "active" },
  },
  { timestamps: true },
);
schema.index({ company: 1, parent: 1 });
schema.index({ company: 1, instanceCompany: 1, parent: 1 });
module.exports = mongoose.model("OrganizationUnit", schema);
