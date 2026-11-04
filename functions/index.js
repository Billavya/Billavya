/**
 * POS invoice-intake + offer-lookup API — the real backend endpoints
 * referenced in discussion but never built: a POS integration (whether a
 * local agent, a POS vendor's own webhook, or a direct call) talks to these,
 * and they read/write the same `invoices`/`offers` collections the app
 * already reads live via onSnapshot. No other Firebase product in this repo
 * needed a server; these are the operations that genuinely do, because an
 * external, semi-trusted system is the one calling them — unlike the app
 * itself or the merchant portal, which call Firestore directly as a
 * logged-in/known party.
 *
 * Auth (both endpoints): Authorization: Bearer <merchant's apiKey> — looked
 * up against the `merchants` collection. See scripts/generate-pos-api-key.mjs
 * to mint a key.
 *
 * ---- exports.lookupOffers ----
 * The "show the promo code at the counter" endpoint: given a customer's
 * avyayaId, returns every active (unredeemed, unexpired) offer this
 * merchant has pushed to them, each with its redeemable `code`. Meant to be
 * called the moment a customer shows their Avyaya ID — before the sale is
 * even finalized — so the cashier can see and apply a code manually if the
 * POS itself doesn't pass discountCode through to receiveInvoice.
 *
 * ---- exports.receiveInvoice ----
 * Writes one invoice. Accepts the POS's own invoiceNo, merchantName (cross-
 * checked against the authenticated account; a mismatch is rejected — the
 * body can self-report who it is, but can't impersonate a different
 * business), merchantAddress (NOT cross-checked, so one key can serve
 * multiple branch addresses for a chain), and transactionTime (drives
 * createdAtMs/date — the actual sale time, not whenever this endpoint
 * happens to receive the call). Country, folder/category, and GSTIN are
 * still pulled from the authenticated merchant record, not the body —
 * those determine which app-side query scope the invoice lands in.
 *
 * discountCode (optional): if given, redeems that specific offer for this
 * avyayaId. If OMITTED, the function auto-detects the best still-active
 * offer for this (avyayaId, merchant) pair and redeems that instead — the
 * auto-activation + auto-detection flow requested alongside this — subject
 * to the offer's own minSpend condition if it has one (an offer born from a
 * "spent more than ___" criterion only auto-applies to an invoice that
 * itself clears that threshold; every other criterion type was already
 * validated against the customer's history at campaign-push time, so no
 * further per-invoice condition applies). Either way, this only ever marks
 * an offer REDEEMED for tracking — it never recomputes the invoice's own
 * total. The actual discount is still the POS's own number (via its
 * `discount` field); auto-detecting here only prevents double-discounting
 * by leaving the money to whichever system the cashier actually used.
 *
 * loyaltyPoints (optional): stored on the invoice as given, AND atomically
 * accrued into a real running balance — loyaltyPoints/{avyayaId}__{merchant
 * slug}, with an append-only `entries` subcollection underneath recording
 * one entry per invoice (points, invoiceId, invoiceNo, createdAtMs). The
 * invoice write and the balance/entry writes happen in one runTransaction,
 * so a sale is never half-recorded. There is still no redemption/spend
 * flow — this is accrual only, surfaced read-only via lookupLoyalty below.
 *
 * ---- exports.lookupLoyalty ----
 * Mirrors lookupOffers: given a customer's avyayaId, returns their current
 * points balance at this merchant (0 if they have never accrued any here).
 * Read-only — there is no endpoint that spends/redeems points yet.
 *
 * Deployment note: Cloud Functions require the Firebase project to be on
 * the Blaze (pay-as-you-go) plan — this project is currently on Spark. The
 * Blaze plan still has a large free monthly invocation quota; these
 * functions cost nothing until real volume passes it. Test locally first
 * with the Firebase emulator (`firebase emulators:start --only functions`),
 * which needs no plan upgrade at all.
 */
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const crypto = require("crypto");
const Stripe = require("stripe");

admin.initializeApp();
const db = admin.firestore();

const AVYAYA_ID_RE = /^(AVY|SNB)-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;

function badRequest(res, status, error) {
  res.status(status).json({ success: false, error });
}

/** Shared by both endpoints — resolves the API key to a merchant record, or writes the appropriate error response itself and returns null. */
async function authenticateMerchant(req, res) {
  const authHeader = req.get("Authorization") || "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch) {
    badRequest(res, 401, "Missing 'Authorization: Bearer <apiKey>' header.");
    return null;
  }
  const apiKey = bearerMatch[1].trim();
  if (!apiKey) {
    badRequest(res, 401, "Empty API key.");
    return null;
  }
  try {
    const merchantSnap = await db.collection("merchants").where("apiKey", "==", apiKey).limit(1).get();
    if (merchantSnap.empty) {
      badRequest(res, 401, "Invalid API key.");
      return null;
    }
    return merchantSnap.docs[0].data();
  } catch (e) {
    console.error("merchant lookup failed", e);
    badRequest(res, 500, "Could not verify API key.");
    return null;
  }
}

function normalizeAvyayaId(raw) {
  const s = typeof raw === "string" ? raw.trim() : "";
  return AVYAYA_ID_RE.test(s) ? s.toUpperCase() : null;
}

/**
 * Deterministic doc id for a (customer, merchant) loyalty balance — same
 * (avyayaId, merchant) scoping fetchActiveOffers already uses for offers, so
 * points are per-business, not a single pooled balance across every
 * merchant a customer has ever bought from. A plain query-by-fields doc
 * would also work, but a deterministic id lets receiveInvoice read-then-
 * write the balance inside one runTransaction without a transactional query.
 */
function loyaltyDocId(avyayaId, merchant) {
  const merchantSlug = String(merchant || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
  return `${avyayaId}__${merchantSlug}`;
}

/** Every still-active (unredeemed, unexpired) offer this merchant has pushed to this avyayaId, newest first. */
async function fetchActiveOffers(avyayaId, businessName) {
  const snap = await db.collection("offers").where("avyayaId", "==", avyayaId).where("merchant", "==", businessName).get();
  const now = Date.now();
  return snap.docs
    .map((d) => ({ ref: d.ref, ...d.data() }))
    .filter((o) => !o.redeemedAtMs && (!o.expiresAtMs || o.expiresAtMs > now))
    .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
}

function pctNumber(pctStr) {
  const n = Number(String(pctStr || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// Confirmed bug, not a guess: toLocaleDateString/toLocaleTimeString with no
// `timeZone` option fall back to the executing server's default — Google
// Cloud Functions' Node.js runtime defaults to UTC, not the merchant's local
// time, which silently mislabeled every invoice's displayed date/time by
// several hours (verified against two real invoices on 2026-10-26). Always
// pass an explicit IANA zone derived from the merchant's own country instead
// of the server's default.
function countryTimeZone(country) {
  const zones = { India: "Asia/Kolkata", Canada: "America/Toronto" };
  return zones[country] || "America/Toronto";
}

// =============================================================================
// GET/POST /lookupOffers — "show the promo code at the counter"
// =============================================================================
exports.lookupOffers = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return badRequest(res, 405, "Only GET or POST is supported.");
  }

  const merchantDoc = await authenticateMerchant(req, res);
  if (!merchantDoc) return; // response already sent

  const raw = req.method === "GET" ? req.query.avyayaId : req.body && req.body.avyayaId;
  const avyayaId = normalizeAvyayaId(raw);
  if (!avyayaId) {
    return badRequest(res, 422, "avyayaId is required and must look like AVY-XXXX-XXXX.");
  }

  try {
    const active = await fetchActiveOffers(avyayaId, merchantDoc.businessName || "");
    return res.status(200).json({
      success: true,
      avyayaId,
      offers: active.map((o) => ({
        code: o.code || null,
        pct: o.pct,
        desc: o.desc,
        capAmount: o.capAmount,
        minSpend: o.minSpend || null,
        exp: o.exp,
      })),
    });
  } catch (e) {
    console.error("offer lookup failed", e);
    return badRequest(res, 500, "Could not look up offers.");
  }
});

// =============================================================================
// POST /receiveInvoice
// =============================================================================
exports.receiveInvoice = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== "POST") {
    return badRequest(res, 405, "Only POST is supported.");
  }

  const merchantDoc = await authenticateMerchant(req, res);
  if (!merchantDoc) return; // response already sent

  // ---- Validate the request body ----
  const body = req.body || {};
  const avyayaId = normalizeAvyayaId(body.avyayaId);
  if (!avyayaId) {
    return badRequest(res, 422, "avyayaId is required and must look like AVY-XXXX-XXXX.");
  }

  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return badRequest(res, 422, "items must be a non-empty array of { name, qty, unit }.");
  }
  const normalizedItems = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it || typeof it.name !== "string" || !it.name.trim()) {
      return badRequest(res, 422, `items[${i}].name is required.`);
    }
    if (typeof it.qty !== "number" || !(it.qty > 0)) {
      return badRequest(res, 422, `items[${i}].qty must be a positive number.`);
    }
    if (typeof it.unit !== "number" || it.unit < 0) {
      return badRequest(res, 422, `items[${i}].unit must be a non-negative number.`);
    }
    normalizedItems.push({
      name: it.name.trim(),
      variant: it.variant ? String(it.variant) : null,
      qty: it.qty,
      unit: it.unit,
      amount: Math.round(it.qty * it.unit * 100) / 100,
      // Optional: lets a POS tag each line with its own menu category/aisle
      // (e.g. "Desserts", "Dairy & Eggs") so the campaign builder's category
      // criteria can match exactly instead of guessing from item-name
      // keywords — see itemsText()/hasKeywordMatch() in merchant-portal/index.html.
      category: it.category && typeof it.category === "string" && it.category.trim() ? it.category.trim() : null,
      // Optional pass-through — populated by cloverWebhook when the line
      // item is linked to an Inventory item that has one; null from Square
      // today (its line items never carry a SKU — see the long comment in
      // squareWebhook) and from any ad-hoc/manually-typed line item on
      // either POS. Never required, never fabricated.
      sku: it.sku && typeof it.sku === "string" && it.sku.trim() ? it.sku.trim() : null,
    });
  }

  const discount = typeof body.discount === "number" && body.discount >= 0 ? body.discount : 0;
  const tax = typeof body.tax === "number" && body.tax >= 0 ? body.tax : 0;
  const orderType = typeof body.orderType === "string" && body.orderType.trim() ? body.orderType.trim() : "Walk-in";
  const table = typeof body.table === "string" && body.table.trim() ? body.table.trim() : null;

  const invoiceNo = typeof body.invoiceNo === "string" ? body.invoiceNo.trim() : "";
  if (!invoiceNo) {
    return badRequest(res, 422, "invoiceNo is required.");
  }

  const merchantName = typeof body.merchantName === "string" ? body.merchantName.trim() : "";
  if (!merchantName) {
    return badRequest(res, 422, "merchantName is required.");
  }
  const accountName = String(merchantDoc.businessName || "").trim();
  if (merchantName.toLowerCase() !== accountName.toLowerCase()) {
    return badRequest(
      res,
      403,
      `merchantName "${merchantName}" doesn't match the business this API key belongs to ("${accountName}").`
    );
  }

  const merchantAddress = typeof body.merchantAddress === "string" ? body.merchantAddress.trim() : "";
  if (!merchantAddress) {
    return badRequest(res, 422, "merchantAddress is required.");
  }

  const transactionTimeRaw = body.transactionTime;
  if (typeof transactionTimeRaw !== "string" || !transactionTimeRaw.trim()) {
    return badRequest(res, 422, "transactionTime is required — an ISO 8601 timestamp, e.g. \"2026-10-12T16:01:00-05:00\".");
  }
  const transactionDate = new Date(transactionTimeRaw);
  if (Number.isNaN(transactionDate.getTime())) {
    return badRequest(res, 422, "transactionTime must be a valid ISO 8601 timestamp.");
  }
  const createdAtMs = transactionDate.getTime();

  const explicitDiscountCode = typeof body.discountCode === "string" && body.discountCode.trim() ? body.discountCode.trim() : null;
  const loyaltyPoints = typeof body.loyaltyPoints === "number" && body.loyaltyPoints >= 0 ? body.loyaltyPoints : null;

  // ---- Confirm the customer actually exists — don't write invoices against a made-up ID ----
  try {
    const profileSnap = await db.collection("profiles").where("avyayaId", "==", avyayaId).limit(1).get();
    if (profileSnap.empty) return badRequest(res, 404, "No Avyaya customer found with that ID.");
  } catch (e) {
    console.error("profile lookup failed", e);
    return badRequest(res, 500, "Could not verify avyayaId.");
  }

  // ---- Compute totals server-side — an external caller's own total is never trusted ----
  const subtotal = Math.round(normalizedItems.reduce((s, it) => s + it.amount, 0) * 100) / 100;
  const total = Math.round((subtotal - discount + tax) * 100) / 100;

  // ---- Resolve which offer (if any) this sale redeems ----
  // Explicit discountCode: matched on {code, avyayaId} together, since a
  // code is shared by every customer one campaign run matched (format:
  // AVY-<merchant>-<campaign#>-<monthyear>-<week>-<category>-<criterion>,
  // see generateDiscountCode() in merchant-portal/index.html) — it was never
  // meant to be unique per offer document, so it can't be looked up as one.
  // No code given: auto-detect the best still-active offer for this
  // (avyayaId, merchant) pair — the "it should just appear/apply, not
  // require the cashier to type anything" behavior — subject to minSpend if
  // the offer has one.
  let discountCodeApplied = false;
  let appliedDiscountCode = explicitDiscountCode;
  // Percentage of the matched offer, independent of `discount` (the POS's own
  // reported dollar amount) — the two can legitimately disagree (e.g. a POS
  // that applies the money itself without that amount ever reaching this
  // endpoint), so this is captured directly off the offer doc, not derived
  // from discount/subtotal.
  let appliedDiscountPct = null;
  try {
    if (explicitDiscountCode) {
      const offerSnap = await db
        .collection("offers")
        .where("code", "==", explicitDiscountCode)
        .where("avyayaId", "==", avyayaId)
        .limit(1)
        .get();
      if (!offerSnap.empty) {
        const matchedOffer = offerSnap.docs[0];
        if (!matchedOffer.data().redeemedAtMs) {
          await matchedOffer.ref.update({ redeemedAtMs: createdAtMs });
          discountCodeApplied = true;
          appliedDiscountPct = pctNumber(matchedOffer.data().pct) || null;
        }
      }
    } else {
      const active = await fetchActiveOffers(avyayaId, merchantName);
      // Only offers carrying an actual redeemable code are candidates here —
      // a pre-code-architecture offer with no `code` field has nothing to
      // apply and must never be silently marked redeemed just because it
      // also happens to have no minSpend to fail against.
      const eligible = active.filter((o) => o.code && (!o.minSpend || subtotal >= o.minSpend));
      if (eligible.length) {
        const best = eligible.reduce((a, b) => (pctNumber(b.pct) > pctNumber(a.pct) ? b : a));
        await best.ref.update({ redeemedAtMs: createdAtMs });
        discountCodeApplied = true;
        appliedDiscountCode = best.code || null;
        appliedDiscountPct = pctNumber(best.pct) || null;
      }
    }
  } catch (e) {
    console.error("offer redemption lookup failed", e);
    // Non-fatal either way — the sale still genuinely happened; fall through and save the invoice regardless.
  }

  const invoiceCountry = merchantDoc.country || "India"; // still server-derived — determines query scope, not the caller's to set
  const invoiceTimeZone = countryTimeZone(invoiceCountry);

  const record = {
    avyayaId,
    country: invoiceCountry,
    folder: merchantDoc.category || "Food", // still server-derived, same reason
    merchant: merchantName,
    merchantAddress,
    gstin: merchantDoc.gstin || null,
    date:
      transactionDate.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: invoiceTimeZone }) +
      " · " +
      transactionDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: invoiceTimeZone }),
    createdAtMs,
    invoiceNo,
    table,
    orderType,
    items: normalizedItems, // a real array — see the long comment on itemsText() in merchant-portal/index.html for why this matters
    subtotal,
    discount,
    tax,
    total,
    discountCode: appliedDiscountCode,
    discountPct: appliedDiscountPct,
    loyaltyPoints,
  };

  // ---- Guard against duplicate writes ----
  // A POS webhook (Clover, Square) can redeliver the same event — a retry
  // after a slow/timed-out response, for example — and would otherwise
  // create a second invoice for the same sale. invoiceNo is the POS's own
  // order id, so (merchant, invoiceNo) is what actually identifies "already
  // processed this one," not a one-off idempotency key we'd have to invent.
  try {
    const dupeSnap = await db
      .collection("invoices")
      .where("merchant", "==", merchantName)
      .where("invoiceNo", "==", invoiceNo)
      .limit(1)
      .get();
    if (!dupeSnap.empty) {
      const existing = dupeSnap.docs[0];
      return res.status(200).json({
        success: true,
        invoiceId: existing.id,
        invoiceNo,
        total: existing.data().total,
        duplicate: true,
      });
    }
  } catch (e) {
    console.error("duplicate invoice check failed", e);
    return badRequest(res, 500, "Could not verify invoiceNo.");
  }

  // ---- Write the invoice, and atomically accrue loyalty points alongside it ----
  // loyaltyPoints was accepted-but-unused before this pass (see the module
  // comment at the top of this file) — this is the real ledger: a running
  // balance doc (loyaltyPoints/{avyayaId}__{merchantSlug}) plus an append-
  // only `entries` subcollection underneath it, one entry per invoice, so the
  // balance is never the only record of how it got there. Both the invoice
  // and the points move in one transaction — a sale is never half-recorded
  // (invoice saved, points lost, or vice versa).
  const invoiceRef = db.collection("invoices").doc();
  try {
    if (loyaltyPoints && loyaltyPoints > 0) {
      const balanceRef = db.collection("loyaltyPoints").doc(loyaltyDocId(avyayaId, merchantName));
      const entryRef = balanceRef.collection("entries").doc();
      await db.runTransaction(async (tx) => {
        const balanceSnap = await tx.get(balanceRef);
        const currentPoints = balanceSnap.exists ? Number(balanceSnap.data().points) || 0 : 0;
        tx.set(invoiceRef, record);
        tx.set(
          balanceRef,
          { avyayaId, merchant: merchantName, points: currentPoints + loyaltyPoints, updatedAtMs: createdAtMs },
          { merge: true }
        );
        tx.set(entryRef, { points: loyaltyPoints, invoiceId: invoiceRef.id, invoiceNo, createdAtMs });
      });
    } else {
      await invoiceRef.set(record);
    }
    return res
      .status(201)
      .json({ success: true, invoiceId: invoiceRef.id, invoiceNo, total, discountCodeApplied, discountCode: appliedDiscountCode });
  } catch (e) {
    console.error("invoice write failed", e);
    return badRequest(res, 500, "Could not save the invoice — try again.");
  }
});

// =============================================================================
// GET/POST /lookupLoyalty — "what's this customer's points balance here"
// =============================================================================
exports.lookupLoyalty = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return badRequest(res, 405, "Only GET or POST is supported.");
  }

  const merchantDoc = await authenticateMerchant(req, res);
  if (!merchantDoc) return; // response already sent

  const raw = req.method === "GET" ? req.query.avyayaId : req.body && req.body.avyayaId;
  const avyayaId = normalizeAvyayaId(raw);
  if (!avyayaId) {
    return badRequest(res, 422, "avyayaId is required and must look like AVY-XXXX-XXXX.");
  }

  try {
    const merchant = merchantDoc.businessName || "";
    const balanceSnap = await db.collection("loyaltyPoints").doc(loyaltyDocId(avyayaId, merchant)).get();
    const points = balanceSnap.exists ? Number(balanceSnap.data().points) || 0 : 0;
    return res.status(200).json({ success: true, avyayaId, points });
  } catch (e) {
    console.error("loyalty lookup failed", e);
    return badRequest(res, 500, "Could not look up loyalty points.");
  }
});

// =============================================================================
// Clover POS integration — OAuth connect + webhook-to-receiveInvoice bridge.
//
// How a merchant connects: send them an authorize link you build as
//   https://apisandbox.dev.clover.com/oauth/v2/authorize?client_id=CLOVER_APP_ID&redirect_uri=<this function's URL>&state=<their Avyaya apiKey>
// (sandbox host shown — swap to https://www.clover.com for production).
// Clover redirects back here with ?code=...&merchant_id=...&state=..., which
// cloverOAuthCallback exchanges for a merchant-scoped access token.
//
// ---- exports.cloverOAuthCallback ----
// One-time per merchant connection. Confirms `state` is a real Avyaya apiKey
// (never trusts it blindly), exchanges `code` for an access token, pulls the
// Clover merchant's address, and stores all of it in
// cloverConnections/{cloverMerchantId} — the record cloverWebhook looks up
// on every subsequent order.
//
// ---- exports.cloverWebhook ----
// Clover posts two very different payload shapes to this one URL:
//  (a) one-time setup handshake: { verificationCode } — sent when you click
//      "Send Verification Code" in the dashboard. Logged so you can copy it
//      back into the dashboard's Verification Code field; no further action.
//  (b) ongoing events: { merchants: { <cloverMerchantId>: [{ objectId, type,
//      ts }, ...] } } — for every CREATE on an Order ("O:<orderId>"), fetches
//      the full order from Clover's REST API and looks for an Avyaya ID
//      (AVY-XXXX-XXXX / SNB-XXXX-XXXX, same format normalizeAvyayaId()
//      already validates) inside the order's free-text note. Found: forwards
//      it to this same project's own exports.receiveInvoice over HTTP using
//      the connected merchant's stored apiKey, so every existing validation,
//      total-computation, and offer-auto-redemption rule in receiveInvoice
//      runs completely unchanged — this function only translates a Clover
//      order into the same body receiveInvoice already accepts from any
//      other POS. Not found: logged and skipped. There is currently no way
//      for a Clover order to carry an avyayaId other than a staff member
//      typing it into the order note at checkout (mirrors today's
//      show-the-QR-and-type-it-in step, just moved into Clover's own ticket
//      note) — closing that gap with a real on-register scan is a separate,
//      later build (Clover's Register API), not something this webhook
//      solves on its own.
//
// Known rough edge, flagged rather than guessed at: discount/tax extraction
// below is a best-effort first pass against Clover's documented Order shape.
// Clover's exact discount/tax field semantics can vary by region and order
// type — verify both against a real order payload logged from your own
// sandbox before trusting the numbers on a live invoice.
// =============================================================================
const CLOVER_APP_SECRET = defineSecret("CLOVER_APP_SECRET");

// Not a secret — the same value shown on this app's Settings page in the
// Clover developer dashboard.
// Replaced 2026-10-25: the original app (OZ5OMBKN75EPM) was built against the
// legacy Developer Dashboard; this one was created fresh on the Global
// Developer Platform (GDP) after we traced the unresolved blank "App Market"
// page to a likely legacy/GDP account mismatch. CLOVER_API_BASE below is
// UNVERIFIED for this GDP app — confirm the real sandbox host shown on this
// app's own Settings page before trusting it; do not assume it matches the
// legacy host used previously.
const CLOVER_APP_ID = "5MGWDSQC5WM9P";

const CLOVER_API_BASE = "https://apisandbox.dev.clover.com"; // token/REST host — swap to https://api.clover.com for production
const CLOVER_AUTHORIZE_BASE = "https://sandbox.dev.clover.com"; // human-facing /oauth/v2/authorize host — different from CLOVER_API_BASE; swap to the production authorize host alongside it

// Our own OAuth callback's real, stable URL — needed below because a GDP web
// app's "Alternate Launch Path" ping (merchant_id + client_id, no code) means
// WE must initiate /v2/authorize ourselves, redirect_uri included, rather
// than Clover ever sending us a code directly on that first hit. Confirmed
// against Clover's own docs: "When Clover redirects merchants to the
// Alternate Launch Path, your app must initiate the OAuth flow by calling
// the /v2/authorize endpoint to ensure a seamless launch experience."
const CLOVER_OAUTH_CALLBACK_URL = "https://us-central1-letsgetdirty.cloudfunctions.net/cloverOAuthCallback";

// A GDP web app's App Market "Connect"/"Open the app" click pings our
// Alternate Launch Path with only merchant_id + client_id — never a code,
// and never anything we could use the way a hand-built authorize link uses
// `state` (confirmed against Clover's own docs: our app must call
// /v2/authorize itself from here to get a real code). Clover gives us no
// field at this point to identify which Avyaya business a new, not-yet-
// connected Clover merchant belongs to.
//
// This app is currently private and scoped to exactly one real merchant
// (Naanna Restaurant), so hardcoding that single mapping here is a real,
// deliberate decision for the current scope — not leftover test code. It
// must be revisited (a real cloverMerchantId -> avyayaApiKey lookup, or
// collecting this during the merchant's own onboarding) before this app
// ever needs to serve a second merchant through this self-service path.
const CLOVER_SINGLE_PRIVATE_MERCHANT_AVYAYA_API_KEY = "bavy_live_f3ffa3b39eda2dc0e80327d1a29a4ccbee8908a49cf0d9be";
const AVYAYA_ID_EXTRACT_RE = /(AVY|SNB)-[A-Z0-9]{4}-[A-Z0-9]{4}/i; // searches WITHIN free text, unlike the anchored AVYAYA_ID_RE above

function formatCloverAddress(merchant) {
  const a = (merchant && merchant.address) || {};
  return [a.address1, a.address2, a.city, a.state, a.zip].filter(Boolean).join(", ");
}

// Clover's refresh tokens are single-use — confirmed from their own docs,
// not guessed: each refresh call invalidates the old refresh_token and
// returns a new one, which must be saved or the next refresh fails.
//
// Confirmed root cause of two real outages (2026-10-31): cloverWebhook can
// receive multiple near-simultaneous HTTP calls for one real transaction
// (see the ACTION_MODIFY_ORDER/webhook comment below — "the same order can
// fire multiple UPDATE events, seen twice for one real sale"). Each call
// independently reads cloverConnections, and if both see the same
// not-yet-expired-looking token and both call this function around the same
// moment, the second one is refreshing with a refresh_token the first call
// already consumed — which Clover rejects outright ("Invalid refresh
// token"), permanently breaking the connection until a manual reconnect.
// The re-read immediately below closes most of that window: by the time
// this specific function actually runs (after getFreshCloverConnection's
// own check, plus whatever the caller already did), a concurrent winner has
// usually already written its update, so re-checking against a FRESH read
// catches that and reuses it instead of racing a doomed second refresh call.
// Not a perfect lock — a true fix would need a transaction or claim/lease
// pattern — but it directly targets the actual race that broke this twice.
async function refreshCloverAccessToken(cloverMerchantId, conn) {
  const freshSnap = await db.collection("cloverConnections").doc(cloverMerchantId).get();
  const freshConn = freshSnap.exists ? freshSnap.data() : conn;
  const EXPIRY_BUFFER_MS = 60 * 1000;
  if (freshConn.accessTokenExpiresAtMs && freshConn.accessTokenExpiresAtMs - EXPIRY_BUFFER_MS > Date.now()) {
    // A concurrent call already refreshed it since we last read this connection — use that
    // result instead of attempting a second refresh with a refresh_token that's now stale.
    return freshConn;
  }

  const refreshRes = await fetch(`${CLOVER_API_BASE}/oauth/v2/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: CLOVER_APP_ID, refresh_token: freshConn.refreshToken }),
  });
  const refreshJson = await refreshRes.json();
  if (!refreshRes.ok || !refreshJson.access_token) {
    throw new Error("Clover token refresh failed: " + JSON.stringify(refreshJson));
  }
  const updated = {
    accessToken: refreshJson.access_token,
    refreshToken: refreshJson.refresh_token || freshConn.refreshToken,
    accessTokenExpiresAtMs: refreshJson.access_token_expiration ? refreshJson.access_token_expiration * 1000 : null,
    refreshTokenExpiresAtMs: refreshJson.refresh_token_expiration ? refreshJson.refresh_token_expiration * 1000 : null,
  };
  await db.collection("cloverConnections").doc(cloverMerchantId).update(updated);
  return { ...freshConn, ...updated };
}

// Returns a connection object guaranteed to carry a currently-valid
// accessToken, refreshing first if it's expired (or missing an expiry
// altogether — covers connections made before refresh support existed,
// which have no refreshToken stored and so can't be refreshed at all; those
// will simply keep failing with 401 until the merchant reconnects).
async function getFreshCloverConnection(cloverMerchantId, conn) {
  const EXPIRY_BUFFER_MS = 60 * 1000;
  const isExpiredOrUnknown = !conn.accessTokenExpiresAtMs || conn.accessTokenExpiresAtMs - EXPIRY_BUFFER_MS < Date.now();
  if (conn.refreshToken && isExpiredOrUnknown) {
    return refreshCloverAccessToken(cloverMerchantId, conn);
  }
  return conn;
}

// Best-effort discount total, in cents, from a fetched Clover order.
// Clover's Discount object (confirmed from their REST reference) carries
// either `amount` (cents, signed negative) or `percentage` (a positive
// integer) with a `name` — never both. The nested list shape under
// order.discounts / lineItem.discounts isn't independently confirmed here
// (Clover's own API reference page didn't render the exact JSON through
// normal fetching), only inferred from the same `{ elements: [...] }`
// wrapper this file already relies on for order.lineItems and
// order.payments. Treat this as the same kind of first pass already
// flagged above for tax — verify against a real order carrying a real
// discount (once the on-device discount-application flow exists) before
// fully trusting the number on a live invoice.
function cloverDiscountAmountCents(discount, baseAmountCents) {
  if (!discount) return 0;
  if (typeof discount.amount === "number") return Math.abs(discount.amount);
  if (typeof discount.percentage === "number") return Math.round((discount.percentage / 100) * baseAmountCents);
  return 0;
}

function cloverOrderDiscountCents(order, lineItems) {
  let totalCents = 0;
  const orderSubtotalCents = lineItems.reduce((s, li) => s + (li.price || 0), 0);
  const orderDiscounts = (order.discounts && order.discounts.elements) || [];
  for (const d of orderDiscounts) totalCents += cloverDiscountAmountCents(d, orderSubtotalCents);
  for (const li of lineItems) {
    const liDiscounts = (li.discounts && li.discounts.elements) || [];
    for (const d of liDiscounts) totalCents += cloverDiscountAmountCents(d, li.price || 0);
  }
  return totalCents;
}

// avyaya-flex-scan bakes the redeemed offer's own code into the Clover
// discount's name as a trailing "[CODE]" (MainActivity.applyBestDiscountIfAny
// — same bracket convention its on-screen offer list already uses), so the
// exact offer redeemed is recoverable here instead of guessed. Without this,
// receiveInvoice falls back to auto-detecting the customer's best active
// offer, which can mark the wrong one redeemed when more than one is active.
function extractAppliedOfferCode(order, lineItems) {
  const orderDiscounts = (order.discounts && order.discounts.elements) || [];
  const lineItemDiscounts = lineItems.flatMap((li) => (li.discounts && li.discounts.elements) || []);
  for (const d of [...orderDiscounts, ...lineItemDiscounts]) {
    const m = String((d && d.name) || "").match(/\[([^\]]+)\]\s*$/);
    if (m) return m[1].trim();
  }
  return null;
}

exports.cloverOAuthCallback = onRequest({ cors: true, secrets: [CLOVER_APP_SECRET] }, async (req, res) => {
  const { code, merchant_id: cloverMerchantId, state: avyayaApiKey, client_id: cloverClientId } = req.query;

  // A GDP web app clicked from the App Market hits this same URL (its
  // "Alternate Launch Path") TWICE — confirmed against Clover's own docs,
  // not guessed: the first hit carries only merchant_id + client_id (no code
  // at all), and "your app must initiate the OAuth flow by calling the
  // /v2/authorize endpoint" itself in response — Clover does not push a code
  // to a web app's launch path unprompted. Only the SECOND hit (Clover
  // redirecting back after that authorize call) carries a real code + state.
  if (!code && cloverMerchantId && cloverClientId) {
    const authorizeUrl =
      `${CLOVER_AUTHORIZE_BASE}/oauth/v2/authorize?client_id=${encodeURIComponent(cloverClientId)}` +
      `&merchant_id=${encodeURIComponent(cloverMerchantId)}` +
      `&redirect_uri=${encodeURIComponent(CLOVER_OAUTH_CALLBACK_URL)}` +
      `&state=${encodeURIComponent(CLOVER_SINGLE_PRIVATE_MERCHANT_AVYAYA_API_KEY)}`;
    return res.redirect(authorizeUrl);
  }

  if (!code || !cloverMerchantId || !avyayaApiKey) {
    return badRequest(res, 422, "Missing code, merchant_id, or state on Clover's redirect.");
  }

  try {
    const tokenRes = await fetch(`${CLOVER_API_BASE}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: CLOVER_APP_ID, client_secret: CLOVER_APP_SECRET.value(), code }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      console.error("Clover token exchange failed", tokenJson);
      return badRequest(res, 502, "Clover did not return an access token.");
    }

    // Confirm the apiKey passed through `state` is a real Avyaya merchant before trusting it.
    const merchantSnap = await db.collection("merchants").where("apiKey", "==", avyayaApiKey).limit(1).get();
    if (merchantSnap.empty) {
      return badRequest(res, 401, "The state parameter doesn't match a known Avyaya merchant apiKey.");
    }
    const avyayaMerchant = merchantSnap.docs[0].data();

    let merchantAddress = "";
    try {
      const merchantInfoRes = await fetch(`${CLOVER_API_BASE}/v3/merchants/${cloverMerchantId}`, {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      if (merchantInfoRes.ok) merchantAddress = formatCloverAddress(await merchantInfoRes.json());
    } catch (e) {
      console.error("Could not fetch Clover merchant address (non-fatal)", e);
    }

    await db.collection("cloverConnections").doc(String(cloverMerchantId)).set({
      avyayaApiKey,
      avyayaBusinessName: avyayaMerchant.businessName || null,
      merchantAddress,
      accessToken: tokenJson.access_token,
      // GDP's v2/OAuth flow issues EXPIRING tokens (confirmed by a real 401
      // roughly an hour after connecting, during this session) — the legacy
      // app's tokens never needed this. Both expirations come back as Unix
      // seconds; stored as ms to match Date.now() elsewhere in this file.
      refreshToken: tokenJson.refresh_token || null,
      accessTokenExpiresAtMs: tokenJson.access_token_expiration ? tokenJson.access_token_expiration * 1000 : null,
      refreshTokenExpiresAtMs: tokenJson.refresh_token_expiration ? tokenJson.refresh_token_expiration * 1000 : null,
      connectedAtMs: Date.now(),
    });

    return res.status(200).send("Clover connected to Avyaya — you can close this tab.");
  } catch (e) {
    console.error("cloverOAuthCallback failed", e);
    return badRequest(res, 500, "Could not complete the Clover connection.");
  }
});

exports.cloverWebhook = onRequest({ cors: true }, async (req, res) => {
  const body = req.body || {};

  // (a) one-time verification handshake — copy this value into the dashboard's Verification Code field.
  if (body.verificationCode) {
    console.error("Clover webhook verificationCode:", body.verificationCode);
    return res.status(200).json({ received: true });
  }

  // (b) ongoing order events — processed fully before responding, since Cloud
  // Functions v2 may freeze background work that continues after a response
  // is sent. Fine at low volume; move to a Cloud Tasks queue if that changes.
  const merchants = body.merchants || {};
  for (const cloverMerchantId of Object.keys(merchants)) {
    const connSnap = await db.collection("cloverConnections").doc(cloverMerchantId).get();
    if (!connSnap.exists) {
      console.error("No Clover connection on file for merchant", cloverMerchantId);
      continue;
    }
    let conn = connSnap.data();
    try {
      conn = await getFreshCloverConnection(cloverMerchantId, conn);
    } catch (e) {
      console.error("Could not refresh Clover access token for merchant", cloverMerchantId, e);
      continue;
    }

    for (const event of merchants[cloverMerchantId]) {
      // Confirmed against a real GDP sandbox order: a sale rung up through
      // "New sale" surfaces as type "UPDATE", not "CREATE" — the order is
      // evidently created first and only the subsequent update (items/
      // payment attached) reaches this webhook. Accepting both is safe: the
      // same order can fire multiple UPDATE events (seen twice for one real
      // sale), and receiveInvoice's own (merchant, invoiceNo) duplicate check
      // already protects against writing the same invoice more than once.
      if (!["CREATE", "UPDATE"].includes(event.type) || !String(event.objectId || "").startsWith("O:")) continue;
      const orderId = event.objectId.slice(2);

      try {
        // lineItems.item was added here for SKU capture and immediately broke
        // EVERY order fetch — "Invalid permissions for expandable fields."
        // Clover's API rejects the whole request, not just the extra field,
        // when the connected app's OAuth grant lacks the Inventory scope
        // that expansion needs. Reverted to restore the core pipeline; see
        // the long comment on the items.map below for the safe, permission-
        // free partial fix still in place, and what re-adding this needs.
        const orderRes = await fetch(
          `${CLOVER_API_BASE}/v3/merchants/${cloverMerchantId}/orders/${orderId}?expand=lineItems,payments,discounts,lineItems.discounts`,
          { headers: { Authorization: `Bearer ${conn.accessToken}` } }
        );
        const order = await orderRes.json();
        if (!orderRes.ok) {
          console.error("Could not fetch Clover order", orderId, order);
          continue;
        }

        // The merchant-facing "Note for item or service" field (Virtual
        // Terminal) is NOT stored on the order itself — confirmed against a
        // real sandbox order — it lands on the PAYMENT object instead.
        // Checking order.note too, in case a different checkout flow (a
        // physical register ticket note) does attach it there.
        const payments = (order.payments && order.payments.elements) || [];
        const noteText = payments.map((p) => p.note || "").join(" ") + " " + String(order.note || "");
        const extractMatch = noteText.match(AVYAYA_ID_EXTRACT_RE);
        const avyayaId = extractMatch ? normalizeAvyayaId(extractMatch[0]) : null;
        if (!avyayaId) {
          console.error(`Order ${orderId} has no Avyaya ID in its order/payment notes — skipped.`);
          continue;
        }

        const lineItems = (order.lineItems && order.lineItems.elements) || [];
        const items = lineItems.map((li) => ({
          name: li.name || "Item",
          qty: 1, // Clover bills each unit as its own lineItem rather than carrying a qty field
          unit: (li.price || 0) / 100, // Clover amounts are in cents
          // Full SKU lives on the linked Inventory Item (li.item.sku/.code),
          // which needs lineItems.item expanded on the fetch above — removed
          // (see the comment there) because this app's current Clover OAuth
          // grant doesn't include the Inventory scope that expansion
          // requires, and Clover rejects the WHOLE order fetch over it, not
          // just that field. li.item is therefore always undefined right
          // now, so this safely falls through to li.code — a product code
          // Clover puts directly on the line item itself, no Inventory
          // permission needed, confirmed via Clover's own API reference. To
          // get the full Inventory-linked SKU back: grant this app's Clover
          // Developer Dashboard entry the Inventory read permission, then
          // re-add lineItems.item to the expand param above.
          sku: (li.item && (li.item.sku || li.item.code)) || li.code || null,
        }));
        if (!items.length) {
          console.error(`Order ${orderId} has no line items — skipped.`);
          continue;
        }

        const appliedOfferCode = extractAppliedOfferCode(order, lineItems);

        const receiveRes = await fetch(`${req.protocol}://${req.get("host")}/receiveInvoice`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${conn.avyayaApiKey}` },
          body: JSON.stringify({
            avyayaId,
            items,
            discount: cloverOrderDiscountCents(order, lineItems) / 100,
            discountCode: appliedOfferCode || undefined, // omitted (not null) so JSON.stringify drops it and receiveInvoice falls back to auto-detect, same as before this existed
            tax: (order.taxAmount || 0) / 100,
            orderType: "Walk-in",
            invoiceNo: String(orderId),
            merchantName: conn.avyayaBusinessName,
            merchantAddress: conn.merchantAddress || "Address on file with Clover",
            transactionTime: new Date(order.createdTime || Date.now()).toISOString(),
          }),
        });
        if (!receiveRes.ok) {
          console.error("receiveInvoice rejected Clover order", orderId, await receiveRes.text());
        } else {
          console.error(`Order ${orderId} -> Avyaya invoice for ${avyayaId}`);
        }
      } catch (e) {
        console.error("Error processing Clover order", orderId, e);
      }
    }
  }

  return res.status(200).json({ received: true });
});

// =============================================================================
// Square POS integration — webhook-to-receiveInvoice bridge. Unlike Clover,
// Square documents an explicit field built for exactly this purpose:
// Order.reference_id ("a client-specified ID to associate an entity in
// another system with this order") — confirmed against a real sandbox order
// before relying on it, same discipline as everything else in this file.
//
// Auth model: Square webhook requests are verified per-request via an
// HMAC-SHA256 signature (x-square-hmacsha256-signature header), computed as
// HMAC(notificationUrl + rawRequestBody, signatureKey) — exact algorithm
// taken from Square's own square-nodejs-sdk source (WebhooksHelper), not
// guessed. notificationUrl must match this function's deployed URL byte-for-
// byte with whatever is configured in the Square Developer Dashboard's
// webhook subscription.
//
// Event payloads are lightweight (merchant_id, type, data.id) — the full
// order, including reference_id and line items, requires a follow-up GET,
// same "notification is thin, fetch the real object" pattern as Clover.
// =============================================================================
const SQUARE_SIGNATURE_KEY = defineSecret("SQUARE_SIGNATURE_KEY");
const SQUARE_NOTIFICATION_URL = "https://us-central1-letsgetdirty.cloudfunctions.net/squareWebhook";
const SQUARE_API_BASE = "https://connect.squareupsandbox.com"; // swap to https://connect.squareup.com for production
const SQUARE_API_VERSION = "2026-10-16";

function verifySquareSignature(rawBody, signatureHeader, signatureKey) {
  if (!signatureHeader || !signatureKey) return false;
  const hmac = crypto.createHmac("sha256", signatureKey);
  hmac.update(SQUARE_NOTIFICATION_URL + rawBody);
  const expected = hmac.digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

exports.squareWebhook = onRequest({ cors: true, secrets: [SQUARE_SIGNATURE_KEY] }, async (req, res) => {
  const signatureHeader = req.get("x-square-hmacsha256-signature");
  const rawBody = req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body || {});
  if (!verifySquareSignature(rawBody, signatureHeader, SQUARE_SIGNATURE_KEY.value())) {
    console.error("Square webhook signature verification failed");
    return res.status(401).json({ received: false });
  }

  const event = req.body || {};
  const merchantId = event.merchant_id;
  const eventType = event.type || "";

  // Only order.* events carry a reference_id we can act on; ignore the rest
  // (payment.*, customer.*, etc.) rather than silently mis-handling them.
  if (!eventType.startsWith("order.") || !merchantId) {
    return res.status(200).json({ received: true });
  }

  try {
    const connSnap = await db.collection("squareConnections").doc(merchantId).get();
    if (!connSnap.exists) {
      console.error("No Square connection on file for merchant", merchantId);
      return res.status(200).json({ received: true });
    }
    const conn = connSnap.data();
    const orderId = event.data && event.data.id;
    if (!orderId) return res.status(200).json({ received: true });

    const orderRes = await fetch(`${SQUARE_API_BASE}/v2/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${conn.accessToken}`, "Square-Version": SQUARE_API_VERSION },
    });
    const orderJson = await orderRes.json();
    if (!orderRes.ok) {
      console.error("Could not fetch Square order", orderId, orderJson);
      return res.status(200).json({ received: true });
    }
    const order = orderJson.order;

    // Primary path: order.reference_id, set directly by whoever created the
    // order via API (e.g. Avyaya's own POS bridge).
    //
    // Fallback: a cashier using Square's own POS app (Square for
    // Restaurants' "scan customer QR at checkout" feature) never touches
    // order.reference_id at all — it only attaches order.customer_id to a
    // Customer Directory record. So when reference_id is absent, resolve
    // customer_id -> GET /v2/customers/{id} -> that customer's own
    // reference_id, which is where the Avyaya ID lives once a customer has
    // been enrolled in the merchant's Square Customer Directory with their
    // Avyaya ID set as reference_id. order.reference_id and
    // order.customer_id are independent fields — Square never copies one
    // into the other.
    let avyayaId = normalizeAvyayaId(order.reference_id);
    if (!avyayaId && order.customer_id) {
      try {
        const custRes = await fetch(`${SQUARE_API_BASE}/v2/customers/${order.customer_id}`, {
          headers: { Authorization: `Bearer ${conn.accessToken}`, "Square-Version": SQUARE_API_VERSION },
        });
        const custJson = await custRes.json();
        if (custRes.ok && custJson.customer) {
          avyayaId = normalizeAvyayaId(custJson.customer.reference_id);
        } else {
          console.error("Could not fetch Square customer", order.customer_id, custJson);
        }
      } catch (e) {
        console.error("Error resolving Square customer_id -> reference_id", e);
      }
    }
    if (!avyayaId) {
      console.log(`Square order ${orderId} has no Avyaya ID in reference_id or via customer_id — skipped.`);
      return res.status(200).json({ received: true });
    }

    const items = (order.line_items || []).map((li) => ({
      name: li.name || "Item",
      qty: parseFloat(li.quantity) || 1,
      unit: ((li.base_price_money && li.base_price_money.amount) || 0) / 100,
      // Square's OrderLineItem never carries a SKU directly (confirmed
      // against Square's own API reference) — only catalog_object_id, which
      // points at a CatalogItemVariation in the separate Catalog API. Real
      // SKU capture here needs a dedicated Catalog lookup (batch-retrievable
      // by catalog_object_id, ideally cached — a per-order N+1 call
      // otherwise), which is a real integration, not a one-line add. Left
      // null rather than guessed or silently omitted.
      sku: null,
    }));
    if (!items.length) {
      console.log(`Square order ${orderId} has no line items — skipped.`);
      return res.status(200).json({ received: true });
    }

    const receiveRes = await fetch(`${req.protocol}://${req.get("host")}/receiveInvoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${conn.avyayaApiKey}` },
      body: JSON.stringify({
        avyayaId,
        items,
        discount: ((order.total_discount_money && order.total_discount_money.amount) || 0) / 100,
        tax: ((order.total_tax_money && order.total_tax_money.amount) || 0) / 100,
        orderType: "Walk-in",
        invoiceNo: String(orderId),
        merchantName: conn.avyayaBusinessName,
        merchantAddress: conn.merchantAddress || "Address on file with Square",
        transactionTime: order.created_at || new Date().toISOString(),
      }),
    });
    if (!receiveRes.ok) {
      console.error("receiveInvoice rejected Square order", orderId, await receiveRes.text());
    } else {
      console.log(`Square order ${orderId} -> Avyaya invoice for ${avyayaId}`);
    }
  } catch (e) {
    console.error("Error processing Square order", e);
  }

  return res.status(200).json({ received: true });
});

// =============================================================================
// Stripe Checkout — merchants pay a fee to launch a campaign from
// campaign-restaurant/campaign-groceries (any future per-vertical campaign
// page should call the same endpoint rather than duplicate this).
//
// Flow: the campaign builder page, instead of writing straight to Firestore
// the way it used to, POSTs its campaign payload to createCampaignCheckout,
// which computes the price and returns a Stripe-hosted Checkout URL to
// redirect to. The actual `campaigns` doc is only written by stripeWebhook,
// after Stripe confirms payment (checkout.session.completed) — never on the
// client's own success-page load, so a merchant can't skip paying by just
// navigating to the success URL. The full campaign payload is stashed in a
// pendingCampaignCheckouts doc (Stripe metadata caps at 500 chars/value,
// too small for merchant-portal's nested criteria/filters/pricing) and
// looked back up by its short doc id, which is what actually rides through
// Checkout Session metadata.
//
// Field choices below (ui_mode, billing_address_collection,
// phone_number_collection, automatic_tax, allow_promotion_codes,
// submit_type, integration_identifier, origin_context) were specified
// exactly as given by the user's Checkout Studio configuration — not
// independently chosen here. integration_identifier/origin_context in
// particular read as mobile-app-flavored for what is actually a web page;
// flagged in the TODO doc rather than silently changed.
// =============================================================================
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

// Two separate pricing models exist across the three pages that call this
// endpoint — never trust a client-submitted amount for either, always
// recompute server-side from the campaign's own declared parameters.
//
// Model A — campaign-restaurant / campaign-groceries: flat rate per
// selected criterion. From "Campaign requirements-2.xlsx", Sheet2 ("Pricing
// per parameter"), cross-checked against Sheet1's full Basic/Standard/
// Premium breakdown: all 11 currently-live criteria price identically at
// ₹20 each, regardless of tier. No base fee, no discount-depth component.
const CAMPAIGN_PRICE_PER_CRITERION_PAISE = 2000; // ₹20

// Model B — merchant-portal (the actual production campaign builder, found
// to be a different, more developed page than the two above after the flat
// model shipped). Replicated verbatim from its own tierAmount()/
// CUSTOM_PER_CRITERION_WEEKLY in merchant-portal/index.html — not a
// separate invention; if that client-side rate card ever changes, this must
// change with it.
const MP_TIER_WEEKLY_BASE_INDIA = { basic: 499, standard: 999, premium: 1999 };
const MP_TIER_MONTHLY_BASE_CANADA = { basic: 50, standard: 75, premium: 100 };
const MP_CUSTOM_PER_CRITERION_WEEKLY = { India: 150, Canada: 10 };

function currencyForCountry(country) {
  return country === "Canada" ? "cad" : "inr";
}

/** Returns { amountSmallestUnit, currency } — Stripe's smallest-unit amount (paise/cents), never a float rupee/dollar value. */
function computeCampaignPrice(campaign) {
  const country = campaign.country === "Canada" ? "Canada" : "India";
  const currency = currencyForCountry(country);

  if (campaign.pricingModel === "merchant_portal_tiered") {
    const p = campaign.pricing || {};
    const weeks = Math.max(1, parseInt(p.weeks, 10) || 1);
    if (p.mode === "simple" || p.isPerCriterion) {
      const rate = MP_CUSTOM_PER_CRITERION_WEEKLY[country];
      const count = Math.max(0, parseInt(p.selectedCount, 10) || 0);
      return { amountSmallestUnit: rate * weeks * count * 100, currency };
    }
    const rupeesOrDollars =
      country === "Canada" ? MP_TIER_MONTHLY_BASE_CANADA[p.tierKey] || 0 : (MP_TIER_WEEKLY_BASE_INDIA[p.tierKey] || 0) * weeks;
    return { amountSmallestUnit: rupeesOrDollars * 100, currency };
  }

  // Default: Model A, flat per-criterion (campaign-restaurant/campaign-groceries).
  const criteria = Array.isArray(campaign.criteria) ? campaign.criteria : [];
  return { amountSmallestUnit: criteria.length * CAMPAIGN_PRICE_PER_CRITERION_PAISE, currency };
}

// =============================================================================
// POST /createCampaignCheckout
// =============================================================================
exports.createCampaignCheckout = onRequest({ cors: true, secrets: [STRIPE_SECRET_KEY] }, async (req, res) => {
  if (req.method !== "POST") return badRequest(res, 405, "Only POST is supported.");

  const { campaign, returnUrl } = req.body || {};
  if (!campaign || typeof campaign !== "object") return badRequest(res, 422, "campaign is required.");
  if (!campaign.merchantEmail || !campaign.businessName || !campaign.category) {
    return badRequest(res, 422, "campaign.merchantEmail, businessName, and category are required.");
  }
  if (!returnUrl || typeof returnUrl !== "string") {
    return badRequest(res, 422, "returnUrl is required — the campaign page's own window.location (origin + pathname).");
  }

  try {
    const stripe = new Stripe(STRIPE_SECRET_KEY.value());
    const { amountSmallestUnit, currency } = computeCampaignPrice(campaign);
    if (!(amountSmallestUnit > 0)) {
      return badRequest(res, 422, "Computed campaign price was 0 — check pricingModel/pricing fields on the request.");
    }

    // Stripe metadata values cap at 500 characters — merchant-portal's
    // campaign payload (nested criteria/filters/pricing) regularly exceeds
    // that, which would make session.create throw before any checkout ever
    // starts (silently, from the merchant's side — exactly the "nothing
    // happens, no network call" symptom reported). Stashing the payload in
    // Firestore and passing only its short doc id through metadata avoids
    // the limit regardless of campaign size.
    const pendingRef = await db.collection("pendingCampaignCheckouts").add({
      campaign,
      createdAtMs: Date.now(),
    });

    const session = await stripe.checkout.sessions.create({
      ui_mode: "hosted_page",
      mode: "payment",
      billing_address_collection: "auto",
      phone_number_collection: { enabled: false },
      automatic_tax: { enabled: false },
      allow_promotion_codes: false,
      submit_type: "auto",
      integration_identifier: "hosted_mobile_app_0001",
      origin_context: "mobile_app",
      customer_email: campaign.merchantEmail,
      success_url: `${returnUrl}?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}?stripe=cancel`,
      line_items: [
        {
          price_data: {
            currency,
            unit_amount: amountSmallestUnit,
            product_data: {
              name: `${campaign.tier || campaign.tierLabel || "Campaign"} — ${campaign.businessName}`,
              description: `${campaign.category} campaign, ${Array.isArray(campaign.criteria) ? campaign.criteria.length : 0} criteria, ${campaign.duration || ""}`.trim(),
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        pendingCampaignId: pendingRef.id,
      },
    });

    return res.status(200).json({ success: true, url: session.url });
  } catch (e) {
    console.error("createCampaignCheckout failed", e);
    return badRequest(res, 500, "Could not start checkout.");
  }
});

// =============================================================================
// POST /stripeWebhook — the only place a paid campaign actually gets written
// to Firestore. Mirrors squareWebhook's signature-verification discipline.
// =============================================================================
exports.stripeWebhook = onRequest({ cors: true, secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] }, async (req, res) => {
  const stripe = new Stripe(STRIPE_SECRET_KEY.value());
  const signature = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, signature, STRIPE_WEBHOOK_SECRET.value());
  } catch (e) {
    console.error("Stripe webhook signature verification failed", e.message);
    return res.status(400).json({ received: false });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    try {
      const pendingId = session.metadata.pendingCampaignId;
      const pendingSnap = await db.collection("pendingCampaignCheckouts").doc(pendingId).get();
      if (!pendingSnap.exists) {
        console.error("Stripe session", session.id, "had no matching pendingCampaignCheckouts doc", pendingId);
        return res.status(200).json({ received: true });
      }
      const campaign = pendingSnap.data().campaign;
      // `pricing`/`pricingModel` were only needed to recompute the price above — stripping them
      // keeps the stored doc the same shape each page's own pre-Stripe code used to write.
      const { pricing, pricingModel, ...campaignFields } = campaign;
      await db.collection("campaigns").add({
        ...campaignFields,
        // merchant-portal's own flow always wrote status:"paid" (it runs the audience
        // query/offer-push itself right after payment, client-side, unchanged by this
        // integration — see its ?stripe=success handler); campaign-restaurant/groceries wrote
        // status:"submitted" and do no further client-side work. Defaulting to "submitted"
        // preserves that page's existing behavior for any caller that doesn't specify one.
        status: campaignFields.status || "submitted",
        createdAtMs: Date.now(),
        paid: true,
        stripeSessionId: session.id,
        amountPaidSmallestUnit: session.amount_total,
      });
      await pendingSnap.ref.delete();
      console.log(`Stripe session ${session.id} -> campaign created for ${campaign.merchantEmail}`);
    } catch (e) {
      console.error("Could not write campaign from Stripe session", session.id, e);
    }
  }

  return res.status(200).json({ received: true });
});

exports.debugRecentInvoices = onRequest({ cors: true }, async (req, res) => {
  const snap = await db.collection("invoices").orderBy("createdAtMs", "desc").limit(10).get();
  res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
});

exports.debugEcho = onRequest({ cors: true }, async (req, res) => {
  await db.collection("debugEchoLog").add({
    receivedAtMs: Date.now(),
    method: req.method,
    headers: { authorization: req.get("Authorization") || null, contentType: req.get("Content-Type") || null },
    body: req.body || null,
  });
  res.status(200).json({ ok: true, received: req.body || null });
});

exports.debugEchoRead = onRequest({ cors: true }, async (req, res) => {
  const snap = await db.collection("debugEchoLog").orderBy("receivedAtMs", "desc").limit(5).get();
  res.json(snap.docs.map((d) => d.data()));
});

// =============================================================================
// Scheduled: refreshSpotlightSponsors — daily Peak-Hours/Festival Spotlight
// refresh. Writes the same country-level doc IDs the original one-time
// scripts/seed-spotlight-sponsors.mjs used, so src/services/spotlightSponsors.ts
// and useActiveSpotlights.ts need no changes — only the content behind those
// docs now actually changes day to day. See scripts/seed-spotlight-daily.mjs
// for the manually-runnable twin of this exact logic (kept in sync by hand;
// this is the one that actually runs, on Cloud Scheduler, once per day).
//
// Daypart: deterministic rotation by day-of-year through a pool of REAL
// merchants per country/window — simulates "one restaurant per window per
// day" until a real paid-reservation system replaces this rotation.
//
// Festival: only writes a sponsor doc for TODAY when today genuinely falls
// in one of HINDU_FESTIVALS_2026's 3-day windows (ported from
// src/data/spotlightConfig.ts's activeFestivalWindow) — writes nothing on a
// day with no active festival, rather than leaving stale data in place.
// =============================================================================
function spotlightMapsUrl(address) {
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(address);
}
const SPOTLIGHT_DAYPART_POOLS = {
  India: {
    lunch: [
      { merchantName: "Spice Junction", merchantAddress: "14 Brigade Road, Bengaluru, Karnataka 560025", offerLine: "15% off lunch thali, 11 AM–1 PM — dine in or takeout." },
      { merchantName: "Coastal Curry House", merchantAddress: "88 Linking Road, Bandra West, Mumbai, Maharashtra 400050", offerLine: "15% off lunch specials, 11 AM–1 PM." },
      { merchantName: "Punjabi Tadka", merchantAddress: "21 Connaught Place, New Delhi, Delhi 110001", offerLine: "Buy 1 Get 1 on lunch thalis, 11 AM–1 PM." },
    ],
    dinner: [
      { merchantName: "Spice Junction", merchantAddress: "14 Brigade Road, Bengaluru, Karnataka 560025", offerLine: "20% off tonight, 6–9 PM — dine in or takeout." },
      { merchantName: "Coastal Curry House", merchantAddress: "88 Linking Road, Bandra West, Mumbai, Maharashtra 400050", offerLine: "20% off seafood curries tonight, 6–9 PM." },
      { merchantName: "Punjabi Tadka", merchantAddress: "21 Connaught Place, New Delhi, Delhi 110001", offerLine: "Flat 20% off dinner mains, 6–9 PM." },
    ],
  },
  Canada: {
    lunch: [
      { merchantName: "Maple Leaf Bistro", merchantAddress: "245 Queen Street West, Toronto, ON M5V 1Z4", offerLine: "15% off lunch combos, 11 AM–1 PM." },
      { merchantName: "Rocky Mountain Diner", merchantAddress: "830 17th Avenue SW, Calgary, AB T2T 0A1", offerLine: "15% off lunch plates, 11 AM–1 PM." },
      { merchantName: "Vikasitam", merchantAddress: "460 Columbia St W, Waterloo, Ontario, N2T 0C7", offerLine: "15% off lunch thali, 11 AM–1 PM." },
      { merchantName: "Pacific Grill House", merchantAddress: "1038 Robson Street, Vancouver, BC V6E 1A8", offerLine: "15% off lunch grills, 11 AM–1 PM." },
      { merchantName: "Amma", merchantAddress: "123 Placeholder Street, Toronto, ON M1A 1A1", offerLine: "15% off South & North Indian lunch combos, 11 AM–1 PM." },
    ],
    dinner: [
      { merchantName: "Maple Leaf Bistro", merchantAddress: "245 Queen Street West, Toronto, ON M5V 1Z4", offerLine: "20% off dinner mains, 6–9 PM." },
      { merchantName: "Rocky Mountain Diner", merchantAddress: "830 17th Avenue SW, Calgary, AB T2T 0A1", offerLine: "20% off dinner tonight, 6–9 PM." },
      { merchantName: "Vikasitam", merchantAddress: "460 Columbia St W, Waterloo, Ontario, N2T 0C7", offerLine: "20% off dinner thali, 6–9 PM." },
      { merchantName: "Pacific Grill House", merchantAddress: "1038 Robson Street, Vancouver, BC V6E 1A8", offerLine: "20% off dinner grills, 6–9 PM." },
      { merchantName: "Amma", merchantAddress: "123 Placeholder Street, Toronto, ON M1A 1A1", offerLine: "20% off dinner tonight, 6–9 PM." },
    ],
  },
};
const SPOTLIGHT_HINDU_FESTIVALS_2026 = [
  { name: "Makar Sankranti", date: "2026-01-14" },
  { name: "Vasant Panchami", date: "2026-01-23" },
  { name: "Maha Shivratri", date: "2026-02-15" },
  { name: "Holi", date: "2026-03-04" },
  { name: "Ugadi / Gudi Padwa", date: "2026-03-19" },
  { name: "Ram Navami", date: "2026-03-26" },
  { name: "Hanuman Jayanti", date: "2026-04-02" },
  { name: "Guru Purnima", date: "2026-07-29" },
  { name: "Raksha Bandhan", date: "2026-08-28" },
  { name: "Janmashtami", date: "2026-09-04" },
  { name: "Ganesh Chaturthi", date: "2026-09-14" },
  { name: "Navratri Begins", date: "2026-10-11" },
  { name: "Dussehra", date: "2026-10-20" },
  { name: "Karva Chauth", date: "2026-10-29" },
  { name: "Diwali", date: "2026-11-08" },
  { name: "Chhath Puja", date: "2026-11-15" },
];
const SPOTLIGHT_FESTIVAL_WINDOW_DAYS = 3;
const SPOTLIGHT_FESTIVAL_SPONSOR_POOL = [
  { merchantName: "Ganpati Sweets & Mithai", offerLine: "20% off festive mithai boxes." },
  { merchantName: "Silk & Saree House", offerLine: "Flat ₹500 off festive sarees." },
  { merchantName: "Diya Decor Studio", offerLine: "Buy 2 get 1 free on diyas & rangoli kits." },
];

function spotlightDayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
}
function spotlightLocalDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function spotlightActiveFestivalWindow(todayKey, festivals = SPOTLIGHT_HINDU_FESTIVALS_2026) {
  const [ty, tm, td] = todayKey.split("-").map(Number);
  const today = Date.UTC(ty, tm - 1, td);
  for (const festival of festivals) {
    const [y, m, d] = festival.date.split("-").map(Number);
    const festivalDate = Date.UTC(y, m - 1, d);
    const daysUntil = Math.round((festivalDate - today) / 86400000);
    if (daysUntil >= 0 && daysUntil < SPOTLIGHT_FESTIVAL_WINDOW_DAYS) {
      return { festival, dayIndex: SPOTLIGHT_FESTIVAL_WINDOW_DAYS - 1 - daysUntil, daysUntil };
    }
  }
  return null;
}

exports.refreshSpotlightSponsors = onSchedule(
  { schedule: "17 2 * * *", timeZone: "Etc/UTC" },
  async () => {
    const now = new Date();
    const doy = spotlightDayOfYear(now);
    const todayKey = spotlightLocalDateKey(now);
    console.log(`Spotlight daily refresh for ${todayKey} (day ${doy} of year)`);

    for (const country of Object.keys(SPOTLIGHT_DAYPART_POOLS)) {
      for (const window of Object.keys(SPOTLIGHT_DAYPART_POOLS[country])) {
        const pool = SPOTLIGHT_DAYPART_POOLS[country][window];
        const pick = pool[doy % pool.length];
        const id = `${country}_Food_${window}`;
        await db.collection("spotlightSponsors").doc(id).set({
          kind: "daypart",
          country,
          category: "Food",
          window,
          merchantName: pick.merchantName,
          merchantAddress: pick.merchantAddress,
          locationMapUrl: spotlightMapsUrl(pick.merchantAddress),
          offerLine: pick.offerLine,
          active: true,
          createdAtMs: Date.now(),
        });
        console.log(`  ${id} -> ${pick.merchantName}`);
      }
    }

    const active = spotlightActiveFestivalWindow(todayKey);
    if (active) {
      const pick = SPOTLIGHT_FESTIVAL_SPONSOR_POOL[active.dayIndex % SPOTLIGHT_FESTIVAL_SPONSOR_POOL.length];
      const id = `India_Religion_festival_${todayKey}`;
      await db.collection("spotlightSponsors").doc(id).set({
        kind: "festival",
        country: "India",
        category: "Religion",
        date: todayKey,
        festivalName: active.festival.name,
        merchantName: pick.merchantName,
        offerLine: pick.offerLine,
        active: true,
        createdAtMs: Date.now(),
      });
      console.log(`  Festival active: ${active.festival.name} -> ${id} -> ${pick.merchantName}`);
    } else {
      console.log("  No festival window active today.");
    }
  }
);

