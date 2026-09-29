/**
 * PostgreSQL-backed model — compatibility shim with alias fixes.
 * DB column is recipient_id but Mongoose-era code uses `recipient`.
 */
const { model } = require("./compat");
module.exports = model("notifications", {
  fieldAliases: { recipient: "recipient_id", recipientId: "recipient_id" },
});
