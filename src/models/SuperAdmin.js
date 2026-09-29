const bcrypt = require("bcryptjs");
const { model } = require("./compat");

module.exports = model("super_admins", {
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
