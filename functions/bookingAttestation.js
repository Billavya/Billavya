// =============================================================================
// Signed, short-lived, booking-scoped tokens for the privacy-preserving
// booking-verification demo (see "Avyaya - Privacy-Preserving Booking
// Verification.docx" and /booking-demo/). Real signing + validation
// mechanism; the only simulated piece is the ID check itself
// (demoVerifyLicense, standing in for a real document-authentication API).
//
// The signing key is injected by the caller from Secret Manager
// (QR_SIGNING_KEY) — previously a constant in this file, which was never
// acceptable once the repo turned out to be public. Nothing here is hardcoded.
// =============================================================================
const crypto = require("crypto");

const ATTESTATION_TTL_MS = 10 * 60 * 1000; // 10 minutes — long enough to scan at pickup, no longer

function sign(key, payloadB64) {
  return crypto.createHmac("sha256", key).update(payloadB64).digest("hex");
}

function encodeToken(payload, key) {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${sign(key, payloadB64)}`;
}

function decodeToken(token, key) {
  const [payloadB64, signature] = String(token || "").split(".");
  if (!payloadB64 || !signature) return { ok: false, reason: "Malformed token." };
  const a = Buffer.from(sign(key, payloadB64));
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "Signature mismatch — token was not issued by Avyaya, or was tampered with." };
  }
  try {
    return { ok: true, payload: JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) };
  } catch (e) {
    return { ok: false, reason: "Could not parse token payload." };
  }
}

module.exports = { encodeToken, decodeToken, ATTESTATION_TTL_MS };
