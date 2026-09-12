const mongoose = require("mongoose");

// Tenant-defined roles (MD §15). Members inherit the union of stock grants +
// custom-permission grants, minus explicit denies. Tenant custom roles can
// NEVER contain SaaS-level permissions (validated).
const customRoleSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    key: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    module: { type: String, default: "itsm" },
    // Stock permission keys (e.g. tickets.view) and/or custom keys.
    permissions: { type: [String], default: [] },
    deniedPermissions: { type: [String], default: [] },
    recordScopes: { type: [String], default: [] }, // OWN, ASSIGNED_TO_ME, TEAM, ...
    fieldAccess: { type: [String], default: [] },
    agentMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Agent" }],
    teamMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Team" }],
    effectiveFrom: { type: Date, default: null },
    effectiveUntil: { type: Date, default: null },
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
      index: true,
    },
    systemDefined: { type: Boolean, default: false },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      default: null,
    },
  },
  { timestamps: true },
);

customRoleSchema.index({ company: 1, key: 1 }, { unique: true });

// SaaS privilege boundary: tenant custom roles may not mint platform rights.
customRoleSchema.pre("validate", function blockSaasEscalation(next) {
  const banned = (this.permissions || []).filter(
    (p) => typeof p === "string" && /^(saas\.|platform\.|superadmin)/.test(p),
  );
  if (banned.length)
    return next(
      new Error(
        `Custom roles cannot grant SaaS permissions: ${banned.join(", ")}`,
      ),
    );
  next();
});

module.exports = mongoose.model("CustomRole", customRoleSchema);
