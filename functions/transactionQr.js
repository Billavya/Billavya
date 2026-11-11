// =============================================================================
// Per-transaction (rotating) QR codes — the "dynamic QR" the product
// literature describes as the flagship item, real for accounts that opt in
// (profiles/{email}.dynamicQr === true; see issueTransactionQr).
//
// What the customer's QR encodes:
//   avyaya://profile/AVY-0K7M-Q3XZ?t=<nonce>.<expMinutes>.<sig>
//                    └── rotating ALIAS, not the real avyayaId ──┘
//
// The alias is the whole point: the customer's real, permanent AVY-XXXX-XXXX
// never appears in the QR at all, so photographing or screenshotting a code
// reveals nothing about WHO the customer is, and two scans of the same
// customer aren't linkable to each other.
//
// Why the alias is still AVY-shaped rather than an opaque blob: the Clover
// Flex scan app (avyaya-flex-scan, MainActivity.extractAvyayaId) refuses any
// scan that doesn't match (AVY|SNB)-[A-Z0-9]{4}-[A-Z0-9]{4} — so an opaque
// code would require shipping a new APK to every merchant. Keeping the shape
// means EVERY existing Flex build (v1.8 and older included) keeps working
// untouched.
//
// Collision with a real customer ID is impossible, not merely unlikely: real
// IDs are generated from "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" (src/utils/
// profileId.ts — deliberately no 0/O/1/I, to avoid look-alikes), while every
// alias is forced to start with "0". A real ID therefore can never equal an
// alias. Resolution is also existence-checked against Firestore, so an
// unknown AVY- value is simply treated as a real ID, never guessed at.
//
// Signing key: QR_SIGNING_KEY from Secret Manager, passed in by the caller —
// nothing in this file knows the key, and nothing here is hardcoded.
// =============================================================================
const crypto = require("crypto");

const TRANSACTION_QR_TTL_MS = 10 * 60 * 1000; // 10 minutes, then the app silently issues a fresh one
const SIG_HEX_CHARS = 16; // 64-bit truncated HMAC — ample for a 10-minute, single-use code
const TOKEN_RE = /([A-Za-z0-9_-]{11})\.([0-9a-z]{1,8})\.([0-9a-f]{16})/;

// Alias charset: the full set the scanner's regex accepts. The leading "0" is
// what guarantees no overlap with a real ID (see the note above), leaving 7
// random characters -> 36^7 ≈ 7.8e10 possibilities per 10-minute window.
const ALIAS_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const ALIAS_PREFIX = "0";

/** True for values this module minted — never true for a real customer ID. */
function isAlias(id) {
  return typeof id === "string" && /^(AVY|SNB)-0[A-Z0-9]{3}-[A-Z0-9]{4}$/i.test(id.trim());
}

function generateAlias() {
  const bytes = crypto.randomBytes(7);
  let rest = "";
  for (let i = 0; i < 7; i++) rest += ALIAS_CHARS[bytes[i] % ALIAS_CHARS.length];
  return `AVY-${ALIAS_PREFIX}${rest.slice(0, 3)}-${rest.slice(3)}`;
}

function sign(key, subject, nonce, expMinutes) {
  return crypto.createHmac("sha256", key).update(`${subject}|${nonce}|${expMinutes}`).digest("hex").slice(0, SIG_HEX_CHARS);
}

/**
 * Mints one rotating code. `subject` is the ALIAS (what the QR shows), so the
 * signature can be checked without first knowing which customer it maps to.
 */
function issueTransactionToken(key, now = Date.now()) {
  const alias = generateAlias();
  const nonce = crypto.randomBytes(8).toString("base64url"); // 11 chars, 64 bits
  const expiresAtMs = Math.ceil((now + TRANSACTION_QR_TTL_MS) / 60000) * 60000;
  const expMinutes = (expiresAtMs / 60000).toString(36);
  const token = `${nonce}.${expMinutes}.${sign(key, alias, nonce, expMinutes)}`;
  return { alias, token, nonce, expiresAtMs, qrValue: `avyaya://profile/${alias}?t=${token}` };
}

function verifyTransactionToken(key, alias, token, now = Date.now()) {
  const m = String(token || "").match(TOKEN_RE);
  if (!m) return { ok: false, reason: "malformed" };
  const [, nonce, expMinutes, sig] = m;
  const expected = Buffer.from(sign(key, alias, nonce, expMinutes));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return { ok: false, reason: "signature" };
  const expiresAtMs = parseInt(expMinutes, 36) * 60000;
  if (!(expiresAtMs > 0) || now > expiresAtMs) return { ok: false, reason: "expired" };
  return { ok: true, nonce, expiresAtMs };
}

/** Pulls a token out of free text (an order note), or null. */
function findTransactionToken(text) {
  const m = String(text || "").match(TOKEN_RE);
  return m ? m[0] : null;
}

module.exports = {
  issueTransactionToken,
  verifyTransactionToken,
  findTransactionToken,
  isAlias,
  TRANSACTION_QR_TTL_MS,
};
