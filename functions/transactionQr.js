// =============================================================================
// Per-transaction (rotating) QR tokens — the "dynamic QR" the product
// literature describes as the flagship future item, now real for accounts
// that opt in (profiles/{email}.dynamicQr === true; see issueTransactionQr).
//
// Shape of what the customer's QR encodes:
//   avyaya://profile/AVY-XXXX-XXXX?t=<nonce>.<expMinutes>.<sig>
// The static prefix is unchanged on purpose — the Clover Flex scan app
// (avyaya-flex-scan, MainActivity.extractAvyayaId) only ever extracts the
// AVY-XXXX-XXXX part with a regex and writes THAT to the order note, so a
// token-bearing QR scans exactly like a static one today. Nothing breaks.
//
// Two levels of binding, both server-side in receiveInvoice:
//   "strict" — the token itself reached the backend (a future Flex build
//              that forwards the whole scanned value) and its signature,
//              expiry, and single-use all check out. This is the real
//              guarantee: THIS transaction was made with THIS fresh code.
//   "window" — only the bare avyayaId reached the backend (today's Flex),
//              but that account had an unused, unexpired token issued in the
//              last few minutes. Weaker (presence, not possession) — labeled
//              as such on the invoice rather than pretending otherwise.
//
// Signing key: QR_SIGNING_KEY from Secret Manager, passed in by the caller —
// nothing in this file knows the key, and nothing here is hardcoded.
// =============================================================================
const crypto = require("crypto");

const TRANSACTION_QR_TTL_MS = 10 * 60 * 1000; // 10 minutes, then the app silently issues a fresh one
const SIG_HEX_CHARS = 16; // 64-bit truncated HMAC — ample for a 10-minute, single-use code
const TOKEN_RE = /([A-Za-z0-9_-]{11})\.([0-9a-z]{1,8})\.([0-9a-f]{16})/;

function sign(key, avyayaId, nonce, expMinutes) {
  return crypto.createHmac("sha256", key).update(`${avyayaId}|${nonce}|${expMinutes}`).digest("hex").slice(0, SIG_HEX_CHARS);
}

function issueTransactionToken(key, avyayaId, now = Date.now()) {
  const nonce = crypto.randomBytes(8).toString("base64url"); // 11 chars, 64 bits of randomness
  const expiresAtMs = Math.ceil((now + TRANSACTION_QR_TTL_MS) / 60000) * 60000;
  const expMinutes = (expiresAtMs / 60000).toString(36);
  const token = `${nonce}.${expMinutes}.${sign(key, avyayaId, nonce, expMinutes)}`;
  return { token, nonce, expiresAtMs, qrValue: `avyaya://profile/${avyayaId}?t=${token}` };
}

function verifyTransactionToken(key, avyayaId, token, now = Date.now()) {
  const m = String(token || "").match(TOKEN_RE);
  if (!m) return { ok: false, reason: "malformed" };
  const [, nonce, expMinutes, sig] = m;
  const expected = Buffer.from(sign(key, avyayaId, nonce, expMinutes));
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

module.exports = { issueTransactionToken, verifyTransactionToken, findTransactionToken, TRANSACTION_QR_TTL_MS };
