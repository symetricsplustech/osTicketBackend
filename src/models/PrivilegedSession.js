const mongoose = require('mongoose');

// Audited privileged support sessions (MD §8): support impersonation and
// break-glass access. Every action taken under the session token must retain
// realActorId vs effectiveActorId; sessions are short-lived and revocable,
// and the auth layer rejects expired/revoked session tokens.
const privilegedSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    kind: { type: String, enum: ['impersonation', 'break_glass'], required: true, index: true },
    realActor: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin', required: true },
    realActorEmail: { type: String, default: '' },
    effectiveActor: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    targetTenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    targetUser: { type: String, default: '' },
    reason: { type: String, required: true },
    approvedBy: { type: String, default: '' }, // break-glass is self-approved emergency
    breakGlass: { type: Boolean, default: false },
    startedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null },
    terminationReason: { type: String, default: '' },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    correlationId: { type: String, default: '' },
    status: { type: String, enum: ['active', 'expired', 'revoked'], default: 'active', index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PrivilegedSession', privilegedSessionSchema);
