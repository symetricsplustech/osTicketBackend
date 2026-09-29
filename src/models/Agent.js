const bcrypt = require("bcryptjs");
const { model } = require("./compat");

module.exports = model("agents", {
  fieldAliases: { role: "role_id", company: "company_id" },
  jsonColumns: ["instance_memberships"],
  instanceMethods: {
    matchPassword(plain) {
      return bcrypt.compare(plain, this.password);
    },
  },
  hooks: {
    async preSave(row, isUpdate) {
      if (row.password && !row.password.startsWith("$2")) {
        row.password = await bcrypt.hash(row.password, 10);
      }
      return row;
    },
  },
});
