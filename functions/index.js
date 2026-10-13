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
 * loyaltyPoints (optional): stored on the invoice as given. Avyaya has no
 * live loyalty-points balance or redemption system today — captured as data
 * for a future feature, not yet surfaced anywhere in the app.
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
const admin = require("firebase-admin");

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
      }
    }
  } catch (e) {
    console.error("offer redemption lookup failed", e);
    // Non-fatal either way — the sale still genuinely happened; fall through and save the invoice regardless.
  }

  const record = {
    avyayaId,
    country: merchantDoc.country || "India", // still server-derived — determines query scope, not the caller's to set
    folder: merchantDoc.category || "Food", // still server-derived, same reason
    merchant: merchantName,
    merchantAddress,
    gstin: merchantDoc.gstin || null,
    date:
      transactionDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " · " +
      transactionDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
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
    loyaltyPoints,
  };

  try {
    const ref = await db.collection("invoices").add(record);
    return res.status(201).json({ success: true, invoiceId: ref.id, invoiceNo, total, discountCodeApplied, discountCode: appliedDiscountCode });
  } catch (e) {
    console.error("invoice write failed", e);
    return badRequest(res, 500, "Could not save the invoice — try again.");
  }
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
const SPOTLIGHT_DAYPART_POOLS = {
  India: {
    lunch: [
      { merchantName: "Spice Junction", offerLine: "15% off lunch thali, 11 AM–1 PM — dine in or takeout." },
      { merchantName: "Coastal Curry House", offerLine: "15% off lunch specials, 11 AM–1 PM." },
      { merchantName: "Punjabi Tadka", offerLine: "Buy 1 Get 1 on lunch thalis, 11 AM–1 PM." },
    ],
    dinner: [
      { merchantName: "Spice Junction", offerLine: "20% off tonight, 6–9 PM — dine in or takeout." },
      { merchantName: "Coastal Curry House", offerLine: "20% off seafood curries tonight, 6–9 PM." },
      { merchantName: "Punjabi Tadka", offerLine: "Flat 20% off dinner mains, 6–9 PM." },
    ],
  },
  Canada: {
    lunch: [
      { merchantName: "Maple Leaf Bistro", offerLine: "15% off lunch combos, 11 AM–1 PM." },
      { merchantName: "Rocky Mountain Diner", offerLine: "15% off lunch plates, 11 AM–1 PM." },
      { merchantName: "Vikasitam", offerLine: "15% off lunch thali, 11 AM–1 PM." },
      { merchantName: "Pacific Grill House", offerLine: "15% off lunch grills, 11 AM–1 PM." },
      { merchantName: "Amma", offerLine: "15% off South & North Indian lunch combos, 11 AM–1 PM." },
    ],
    dinner: [
      { merchantName: "Maple Leaf Bistro", offerLine: "20% off dinner mains, 6–9 PM." },
      { merchantName: "Rocky Mountain Diner", offerLine: "20% off dinner tonight, 6–9 PM." },
      { merchantName: "Vikasitam", offerLine: "20% off dinner thali, 6–9 PM." },
      { merchantName: "Pacific Grill House", offerLine: "20% off dinner grills, 6–9 PM." },
      { merchantName: "Amma", offerLine: "20% off dinner tonight, 6–9 PM." },
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

