const { model } = require("./compat");

const AuthorizationGrant = model("authorization_grants", {
  fieldAliases: {
    tenantId: "tenant_id",
    granteeId: "grantee_id",
    granteeType: "grantee_type",
    expiresAt: "expires_at",
    grantedBy: "granted_by",
    revokedAt: "revoked_at",
    revokedBy: "revoked_by",
  },
});

module.exports = AuthorizationGrant;