const { SignatureRequest } = require('../models/Platform3');

// Internal e-signature: tokenized consent link + tamper-evident hash.
// DocuSign adapter activates automatically when DOCUSIGN_INTEGRATOR_KEY etc. are configured.
async function createSignatureRequest({ tenantId, sentBy, entityType, entityId, documentTitle, signerName, signerEmail, expiresInDays = 14 }) {
  const expiresAt = new Date(Date.now() + expiresInDays * 86400000);
  const doc = await SignatureRequest.create({
    entityType, entityId, documentTitle, signerName, signerEmail,
    token: SignatureRequest.newToken(),
    expiresAt,
    sentBy,
    provider: process.env.DOCUSIGN_ACCOUNT_ID ? 'docusign' : 'internal',
    tenantId,
  });
  if (doc.provider === 'docusign') {
    try {
      // DocuSign JWT-utility flow requires a signed RSA JWT; when creds exist we create the envelope via REST.
      const docusign = require('./docusign.adapter.js');
      const envelopeId = await docusign.createEnvelope({ signerEmail, signerName, documentTitle, entityId });
      doc.hash = `docusign:${envelopeId}`;
      await doc.save();
    } catch (_) {
      doc.provider = 'internal'; // graceful fallback
    }
  }
  return doc;
}

async function signByToken({ token, typedName, ip }) {
  const req = await SignatureRequest.findOne({ token });
  if (!req) return { error: 'not_found' };
  if (req.status !== 'sent') return { error: 'already_' + req.status };
  if (req.expiresAt && req.expiresAt < new Date()) {
    req.status = 'expired';
    await req.save();
    return { error: 'expired' };
  }
  if (!typedName || typedName.trim().toLowerCase() !== req.signerName.trim().toLowerCase()) {
    return { error: 'name_mismatch' };
  }
  req.status = 'signed';
  req.signedAt = new Date();
  req.signedName = typedName.trim();
  req.signerIp = ip;
  req.hash = SignatureRequest.computeHash([String(req.entityId), req.signerEmail, req.signedAt.toISOString(), ip]);
  await req.save();
  return { request: req };
}

module.exports = { createSignatureRequest, signByToken };
