const { model } = require("./compat");

module.exports = model("instance_domains", {
  fieldAliases: {
    instanceId: "instance_id",
    verificationToken: "verification_token",
    verificationMethod: "verification_method",
    verificationRecord: "verification_record",
    isPrimary: "is_primary",
    redirectToPrimary: "redirect_to_primary",
    tlsStatus: "tls_status",
    tlsCertificate: "tls_certificate",
    tlsPrivateKey: "tls_private_key",
    tlsExpiresAt: "tls_expires_at",
    tlsProvider: "tls_provider",
    verifiedAt: "verified_at",
    verifiedBy: "verified_by",
    activatedAt: "activated_at",
    activatedBy: "activated_by",
    disabledAt: "disabled_at",
    disabledBy: "disabled_by",
    failureReason: "failure_reason",
  },
  instanceMethods: {
    isActive() {
      return this.status === "active";
    },
    isVerified() {
      return this.status === "verified" || this.status === "active";
    },
  },
});
