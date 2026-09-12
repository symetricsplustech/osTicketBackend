const mongoose = require("mongoose");

// Tenant-defined business permissions (MD §16). Extend tenant authorization
// WITHOUT touching code or the stock Role.permissions enum. NEVER override:
// authentication, tenant isolation, SaaS boundaries, module entitlement or
// platform security — the engine only grants/denies tenant business actions.
const customPermissionSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    key: { type: String, required: true, trim: true }, // e.g. custom.itsm.incident.approve_p1
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    module: { type: String, default: "itsm" },
    resource: { type: String, default: "" },
    action: { type: String, default: "" },
    effect: { type: String, enum: ["allow", "deny"], default: "allow" },
    scope: { type: String, default: "" }, // optional: OWN, ASSIGNED_TO_ME, TEAM, ...
    conditions: { type: mongoose.Schema.Types.Mixed, default: [] }, // [{field,op,value}]
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

customPermissionSchema.index({ company: 1, key: 1 }, { unique: true });

module.exports = mongoose.model("CustomPermission", customPermissionSchema);
