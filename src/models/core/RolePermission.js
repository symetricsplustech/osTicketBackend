const mongoose = require("mongoose");

const rolePermissionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
      index: true,
    },
    permissionKey: { type: String, required: true, index: true },
    effect: { type: String, enum: ["allow", "deny"], default: "allow" },
    scope: {
      type: String,
      enum: [
        "own",
        "assigned",
        "group",
        "department",
        "organization",
        "tenant",
        "global",
      ],
      default: "own",
    },
    conditions: { type: mongoose.Schema.Types.Mixed, default: {} },
    fieldRestrictions: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

rolePermissionSchema.index(
  { tenantId: 1, roleId: 1, permissionKey: 1 },
  { unique: true },
);

module.exports = mongoose.model("RolePermission", rolePermissionSchema);
