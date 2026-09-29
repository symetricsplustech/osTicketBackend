/**
 * PostgreSQL-backed model — auto-generated compatibility shim.
 */
const { model } = require("./compat");
const MessageBundle = model("message_bundles", {});
const TenantLocalePreference = model("tenant_locale_preferences", {});
const UserLocalePreference = model("user_locale_preferences", {});
module.exports = { MessageBundle, TenantLocalePreference, UserLocalePreference };
