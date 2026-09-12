const mongoose = require("mongoose");
const schema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    principal: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    principalType: { type: String, required: true },
    roles: [{ type: mongoose.Schema.Types.ObjectId, ref: "Role" }],
    moduleKeys: { type: [String], default: [] },
    unitScopes: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    departmentScopes: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    locationScopes: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    teamScopes: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    active: { type: Boolean, default: true },
    startsAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);
module.exports = mongoose.model("AccessAssignment", schema);
