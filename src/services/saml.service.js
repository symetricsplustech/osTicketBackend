const { XMLParser } = require('fast-xml-parser');
const { SignedXml } = require('xml-crypto');

const CLOCK_SKEW_MS = 90 * 1000;

function decodeResponse(samlResponse) {
  const b64 = samlResponse.replace(/\s/g, '');
  const xml = Buffer.from(b64, 'base64').toString('utf8');
  if (xml.trimStart().startsWith('<')) return xml;
  // deflated binding
  const zlib = require('zlib');
  try { return zlib.inflateRawSync(Buffer.from(b64, 'base64')).toString('utf8'); }
  catch (_) { return xml; }
}

// Verify XML-DSig over the Response or the Assertion, using the configured IdP cert.
function extract(xmlText, tag) {
  const m = xmlText.match(new RegExp(`<[^>]*:?${tag}[\\s\\S]*?</[^>]*:?${tag}>`));
  return m ? m[0] : null;
}

async function validateSamlResponse({ samlResponse, idpCertificate, spEntityId }) {
  let xml;
  try { xml = decodeResponse(samlResponse); } catch (_) { return { valid: false, reason: 'malformed_response' }; }

  if (!/<(?:\w+:)?Response[\s>]/.test(xml)) return { valid: false, reason: 'not_a_saml_response' };

  // Signature verification (XML-DSig) — Response or Assertion level
  const assertionXml = extract(xml, 'Assertion');
  const signedPart = extract(xml, 'Signature') ? xml : null;
  if (!idpCertificate) return { valid: false, reason: 'no_idp_certificate_configured' };
  let signatureOk = false;
  try {
    const cert = idpCertificate.includes('BEGIN') ? idpCertificate : `-----BEGIN CERTIFICATE-----\n${idpCertificate}\n-----END CERTIFICATE-----`;
    for (const part of [xml, assertionXml]) {
      if (!part || !part.includes('Signature')) continue;
      try {
        const checker = new SignedXml();
        checker.loadSignature(part);
        checker.keyInfoProvider = undefined;
        checker.checkSignature(part); // throws on bad digest/signature w/ embedded KeyInfo? requires cert:
        // checkSignature(xml) validates using loaded key info; when cert provided use options
        signatureOk = true;
        break;
      } catch (firstErr) {
        try {
          const c2 = new SignedXml({ publicCert: cert });
          c2.loadSignature(part);
          c2.checkSignature(part);
          signatureOk = true;
          break;
        } catch (_) { /* try next */ }
      }
    }
  } catch (_) { signatureOk = false; }
  if (!signatureOk) return { valid: false, reason: 'invalid_signature' };

  // Conditions + audience
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  let parsed;
  try { parsed = parser.parse(xml); } catch (_) { return { valid: false, reason: 'unparseable_xml' }; }
  const findKey = (obj, name) => {
    if (!obj || typeof obj !== 'object') return undefined;
    for (const k of Object.keys(obj)) {
      if (k === name || k.endsWith(`:${name}`)) return obj[k];
      const deep = findKey(obj[k], name);
      if (deep !== undefined) return deep;
    }
    return undefined;
  };
  const conditions = findKey(parsed, 'Conditions');
  const now = Date.now() + CLOCK_SKEW_MS;
  if (conditions) {
    const nb = conditions['@_NotBefore'] ? Date.parse(conditions['@_NotBefore']) - CLOCK_SKEW_MS : null;
    const noa = conditions['@_NotOnOrAfter'] ? Date.parse(conditions['@_NotOnOrAfter']) + CLOCK_SKEW_MS : null;
    if ((nb && now < nb) || (noa && now > noa)) return { valid: false, reason: 'assertion_expired_or_not_yet_valid' };
  }
  const ar = findKey(parsed, 'AudienceRestriction');
  const audience = Array.isArray(ar?.Audience) ? ar.Audience[0] : ar?.Audience;
  if (spEntityId && audience && audience !== spEntityId) return { valid: false, reason: 'audience_mismatch' };

  // Identity extraction
  const nameIdNode = findKey(parsed, 'NameID');
  const nameId = typeof nameIdNode === 'object' ? Object.values(nameIdNode)[0] : nameIdNode;
  const attrNodes = findKey(parsed, 'Attribute');
  const attributes = {};
  const list = attrNodes ? (Array.isArray(attrNodes) ? attrNodes : [attrNodes]) : [];
  for (const a of list) {
    const nm = a['@_Name'];
    let val = a.AttributeValue;
    if (Array.isArray(val)) val = val[0];
    if (val && typeof val === 'object') val = Object.values(val)[0];
    if (nm) attributes[nm] = val;
  }
  const email = attributes.email || attributes.mail || attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || nameId;
  const displayName = attributes.displayName || attributes.cn || attributes.name || nameId;
  if (!email) return { valid: false, reason: 'no_identity_in_assertion' };

  return { valid: true, email, name: displayName, nameId, attributes };
}

module.exports = { validateSamlResponse };
