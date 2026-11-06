// =============================================================================
// Working DEMO of the privacy-preserving booking-verification idea scoped in
// "Avyaya - Privacy-Preserving Booking Verification.docx" — real deployed
// endpoints, a real signed token, real QR code, same spirit as the Clover
// sandbox demo elsewhere in this project. What's simulated: the actual
// government/third-party ID check (demoVerifyLicense just marks a record
// valid, standing in for Phase 1's "manual review" — see the doc's roadmap).
// Everything downstream of that (token issuance, signing, expiry, server-
// side validation) is the real mechanism, not a mock.
//
// DEMO_SIGNING_KEY is a plain in-code constant, not a Firebase secret like
// STRIPE_SECRET_KEY/SQUARE_SIGNATURE_KEY elsewhere in this file — deliberate
// for a prototype that never handles real PII yet. Move this to a real
// secret (defineSecret) before any real license data flows through here.
// =============================================================================
const crypto = require("crypto");

const DEMO_SIGNING_KEY = "avyaya-booking-attestation-demo-key-2026"; // DEMO ONLY — see note above
const ATTESTATION_TTL_MS = 10 * 60 * 1000; // 10 minutes — long enough to scan at pickup, no longer

function sign(payloadB64) {
  return crypto.createHmac("sha256", DEMO_SIGNING_KEY).update(payloadB64).digest("hex");
}

function encodeToken(payload) {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

function decodeToken(token) {
  const [payloadB64, signature] = String(token || "").split(".");
  if (!payloadB64 || !signature) return { ok: false, reason: "Malformed token." };
  const expected = sign(payloadB64);
  const a = Buffer.from(expected);
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
