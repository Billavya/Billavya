/**
 * Prepares the campaign dataset for a merchant and writes the sales report.
 *
 * Run this to (re)snapshot a merchant's invoice book into
 * ~/avyaya-campaign-data/<merchant>/, which is what run-campaign.mjs then
 * matches submitted parameters against.
 *
 *   node scripts/campaign-dataset.mjs                      # Naanna Restaurant
 *   node scripts/campaign-dataset.mjs "Some Other Merchant"
 *
 * Two files land in that folder:
 *   dataset.json — the prepared invoice book (this merchant's invoices, plus
 *                  each of those customers' invoices at every OTHER merchant,
 *                  which the prospecting criteria need as scope.all).
 *   report.json  — the sales analysis + achievable reach for every campaign
 *                  parameter at every option value.
 *
 * Time-relative criteria (lapsed, overdue, declining) are evaluated at RUN
 * time by run-campaign.mjs, not frozen here — so a dataset a few days old
 * still produces correct audiences, it just won't contain newer sales.
 */
import fs from "fs";
import { collection, getDocs, query, where } from "firebase/firestore";
import { firestore, loadEngine, allCriteria, ltvQualifiers, evaluateFor, datasetDir, datasetPath, reportPath } from "./campaign-engine.mjs";

const MERCHANT = process.argv[2] || "Naanna Restaurant";
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const money = (v) => Math.round(num(v) * 100) / 100;

const engine = loadEngine();
console.log(`Engine lifted from merchant-portal/index.html (categories: ${Object.keys(engine.CRITERIA_DATA).join(", ")}).`);

const db = firestore();

// ---- 1. this merchant's book -----------------------------------------------
const mineSnap = await getDocs(query(collection(db, "invoices"), where("merchant", "==", MERCHANT)));
const mine = mineSnap.docs.map((d) => ({ _id: d.id, ...d.data() })).filter((d) => d.avyayaId && d.createdAtMs);
if (!mine.length) throw new Error(`No invoices with an avyayaId + createdAtMs found for merchant "${MERCHANT}".`);
const customerIds = [...new Set(mine.map((d) => d.avyayaId))];
console.log(`${mine.length} invoices · ${customerIds.length} customers at "${MERCHANT}".`);

// ---- 2. the same customers' invoices everywhere else (scope.all) -----------
const allByCustomer = {};
for (let i = 0; i < customerIds.length; i += 10) {
  const chunk = customerIds.slice(i, i + 10);
  const snap = await getDocs(query(collection(db, "invoices"), where("avyayaId", "in", chunk)));
  snap.docs.forEach((d) => {
    const v = { _id: d.id, ...d.data() };
    if (!v.createdAtMs) return;
    (allByCustomer[v.avyayaId] = allByCustomer[v.avyayaId] || []).push(v);
  });
}
Object.values(allByCustomer).forEach((r) => r.sort((a, b) => a.createdAtMs - b.createdAtMs));
const crossCount = Object.values(allByCustomer).reduce((s, r) => s + r.length, 0);
console.log(`${crossCount} invoices across all merchants for those customers (scope.all).`);

// ---- 3. profiles (birthday + radius criteria) ------------------------------
let profiles = {};
let profilesReadable = true;
try {
  const psnap = await getDocs(collection(db, "profiles"));
  psnap.docs.forEach((d) => {
    const v = d.data();
    if (v.avyayaId) profiles[v.avyayaId] = { avyayaId: v.avyayaId, city: v.city || null, birthMonth: v.birthMonth || null, anniversary: v.anniversary || null };
  });
  console.log(`profiles: ${Object.keys(profiles).length} readable.`);
} catch (e) {
  profilesReadable = false;
  console.log(`profiles NOT readable (${e.code || e.message}) — birthday targeting will report as needing data.`);
}

// ---- 4. merchant record ----------------------------------------------------
let merchantDoc = null;
try {
  const msnap = await getDocs(query(collection(db, "merchants"), where("businessName", "==", MERCHANT)));
  if (!msnap.empty) merchantDoc = { _id: msnap.docs[0].id, ...msnap.docs[0].data() };
} catch { /* non-fatal */ }
// Fall back to what the invoices themselves carry.
const merchant = {
  businessName: MERCHANT,
  email: merchantDoc?.email || null,
  apiKeyPresent: !!merchantDoc?.apiKey,
  category: merchantDoc?.category || (mine[0].folder === "Groceries" ? "Groceries" : "Food"),
  country: merchantDoc?.country || mine[0].country || "Canada",
  city: merchantDoc?.city || "Toronto",
  address: merchantDoc?.address || null,
};
const category = merchant.category === "Groceries" ? "Groceries" : "Food";
console.log(`Merchant record: ${merchantDoc ? `merchants/${merchantDoc._id}` : "NOT FOUND (using invoice fields)"} · ${category} · ${merchant.country} · ${merchant.city}`);

// ---- 5. sales analysis -----------------------------------------------------
const sorted = [...mine].sort((a, b) => a.createdAtMs - b.createdAtMs);
const gross = money(mine.reduce((s, d) => s + num(d.total), 0));
const mineByCustomer = engine.buildCustomerIndex(mine);
const dayNames = engine.DAY_NAMES;

// Items our own testing created, not menu sales — separated so revenue
// figures can be read either way instead of quietly including them.
const TEST_ITEM_RE = /\btest\b|custom item|^item \d+$|webhook|timezone|fallback/i;

const byDow = Array.from({ length: 7 }, () => ({ invoices: 0, revenue: 0 }));
const byHour = Array.from({ length: 24 }, () => ({ invoices: 0, revenue: 0 }));
const byDate = {};
for (const d of sorted) {
  const dt = new Date(d.createdAtMs);
  byDow[dt.getDay()].invoices++; byDow[dt.getDay()].revenue += num(d.total);
  byHour[dt.getHours()].invoices++; byHour[dt.getHours()].revenue += num(d.total);
  const k = dt.toISOString().slice(0, 10);
  (byDate[k] = byDate[k] || { invoices: 0, revenue: 0 });
  byDate[k].invoices++; byDate[k].revenue += num(d.total);
}

// Which menu category each item WOULD match, via the portal's own keyword
// map. Marked derived because Clover currently sends category: null on every
// line — see dataGaps.itemCategoryNull.
const KEYWORDS = category === "Groceries" ? engine.GROCERY_AISLE_KEYWORDS : engine.FOOD_CATEGORY_KEYWORDS;
const derivedCategoryOf = (name) => {
  const t = String(name || "").toLowerCase();
  for (const [cat, kws] of Object.entries(KEYWORDS)) {
    if (cat === "Beverages") continue; // label alias of Drinks, same keywords
    if (kws.some((k) => t.includes(k))) return cat;
  }
  return null;
};

const itemStats = {};
let taggedItemLines = 0, totalItemLines = 0;
for (const d of mine) {
  for (const it of engine.invoiceItems(d)) {
    totalItemLines++;
    if (it?.category) taggedItemLines++;
    const name = it?.name || "(unnamed)";
    const s = (itemStats[name] = itemStats[name] || { name, qty: 0, revenue: 0, lines: 0, derivedCategory: derivedCategoryOf(name), taggedCategory: it?.category || null });
    s.qty += num(it?.qty) || 1;
    s.revenue += num(it?.amount);
    s.lines++;
  }
}
const items = Object.values(itemStats)
  .map((s) => ({ ...s, revenue: money(s.revenue), isTestArtifact: TEST_ITEM_RE.test(s.name) }))
  .sort((a, b) => b.revenue - a.revenue);

const customers = customerIds.map((id) => {
  const rows = mineByCustomer[id] || [];
  const spend = money(rows.reduce((s, r) => s + num(r.total), 0));
  const gap = engine.avgGap(rows);
  const last = engine.mostRecent(rows);
  const cats = new Set();
  rows.forEach((r) => engine.invoiceItems(r).forEach((it) => { const c = derivedCategoryOf(it?.name); if (c) cats.add(c); }));
  return {
    avyayaId: id,
    invoices: rows.length,
    lifetimeSpend: spend,
    avgTicket: money(spend / (rows.length || 1)),
    firstVisitMs: engine.earliest(rows),
    lastVisitMs: last,
    daysSinceLast: last ? Math.floor((Date.now() - last) / 86400000) : null,
    avgGapDays: gap ? Math.round((gap / 86400000) * 10) / 10 : null,
    usualDay: rows.length >= 3 ? dayNames[engine.mostCommonDay(rows)] : null,
    derivedCategories: [...cats].sort(),
    singleItemVisits: rows.filter((r) => engine.invoiceItems(r).length === 1).length,
    crossMerchantInvoices: (allByCustomer[id] || []).length,
    otherMerchants: [...new Set((allByCustomer[id] || []).map((r) => r.merchant).filter((m) => m && m !== MERCHANT))].sort(),
  };
}).sort((a, b) => b.lifetimeSpend - a.lifetimeSpend);

// ---- 6. reach for every parameter at every option value --------------------
const criteria = allCriteria(engine, category);
const ltvSets = new Map();
for (const c of criteria.filter((x) => x.isGlobalRanking)) {
  for (const v of c.values) ltvSets.set(`${c.code}|${v}`, ltvQualifiers(v, mineByCustomer));
}

const parameters = criteria.map((c) => {
  const options = c.values.map((value) => {
    const matched = [];
    let nulls = 0;
    for (const id of customerIds) {
      const scopes = { mine: mineByCustomer[id] || [], all: allByCustomer[id] || [] };
      const r = evaluateFor(engine, c, value, id, scopes, profiles[id], merchant.city, ltvSets);
      if (r === null) nulls++;
      else if (r) matched.push(id);
    }
    return { value, reach: matched.length, matched, evaluable: nulls < customerIds.length };
  });
  const evaluable = options.some((o) => o.evaluable);
  const best = options.reduce((a, b) => (b.reach > (a?.reach ?? -1) ? b : a), null);
  // Distinguishes "nobody matches" from "we can't compute this at all", and
  // from "we could compute it if Clover line items carried categories".
  const blockedBy = !evaluable
    ? "not_trackable"
    : ["DRY", "ATC"].includes(c.code) && taggedItemLines === 0
      ? "needs_item_categories"
      : c.code === "BDAY" && !profilesReadable
        ? "needs_profile_access"
        : null;
  return {
    code: c.code, label: c.label, objective: c.objective, tier: c.tier,
    isNew: !!c.isNew, featured: !!c.featured,
    isGlobalRanking: !!c.isGlobalRanking, isMinSpendSource: !!c.isMinSpendSource,
    evaluable, blockedBy, maxReach: best?.reach ?? 0, bestValue: best?.reach ? best.value : null,
    options,
  };
});

// ---- 7. write ---------------------------------------------------------------
fs.mkdirSync(datasetDir(MERCHANT), { recursive: true });

const dataset = {
  schema: 1,
  builtAtMs: Date.now(),
  merchant,
  category,
  customerIds,
  profiles,
  profilesReadable,
  // The two scopes the engine needs, stored exactly as it expects them.
  invoicesAtMerchant: mine,
  invoicesByCustomerAllMerchants: allByCustomer,
};
fs.writeFileSync(datasetPath(MERCHANT), JSON.stringify(dataset));

const report = {
  schema: 1,
  generatedAtMs: Date.now(),
  merchant, category,
  source: "Clover sandbox → cloverWebhook → receiveInvoice",
  totals: {
    invoices: mine.length,
    customers: customerIds.length,
    gross,
    avgTicket: money(gross / mine.length),
    firstMs: sorted[0].createdAtMs,
    lastMs: sorted.at(-1).createdAtMs,
    spanDays: Math.max(1, Math.round((sorted.at(-1).createdAtMs - sorted[0].createdAtMs) / 86400000)),
    repeatCustomers: customers.filter((c) => c.invoices > 1).length,
    discountedInvoices: mine.filter((d) => num(d.discountPct) > 0).length,
    qrStrictInvoices: mine.filter((d) => d.qrTokenBinding === "strict").length,
    testArtifactRevenue: money(items.filter((i) => i.isTestArtifact).reduce((s, i) => s + i.revenue, 0)),
    itemLinesTotal: totalItemLines,
    itemLinesTagged: taggedItemLines,
    distinctItems: items.length,
  },
  dataGaps: {
    itemCategoryNull: taggedItemLines === 0,
    cashierMissing: mine.every((d) => !d.cashier),
    orderTypeValues: [...new Set(mine.map((d) => d.orderType).filter(Boolean))],
    profilesReadable,
    tableAlwaysNull: mine.every((d) => d.table == null),
    loyaltyPointsAlwaysNull: mine.every((d) => d.loyaltyPoints == null),
  },
  byDow: byDow.map((v, i) => ({ day: dayNames[i], invoices: v.invoices, revenue: money(v.revenue) })),
  byHour: byHour.map((v, i) => ({ hour: i, invoices: v.invoices, revenue: money(v.revenue) })).filter((h) => h.invoices),
  byDate: Object.entries(byDate).sort().map(([date, v]) => ({ date, invoices: v.invoices, revenue: money(v.revenue) })),
  items, customers, parameters,
};
fs.writeFileSync(reportPath(MERCHANT), JSON.stringify(report, null, 2));

// ---- 8. summary ------------------------------------------------------------
const d = (ms) => new Date(ms).toISOString().slice(0, 10);
console.log(`\n=========== ${MERCHANT} · ${d(report.totals.firstMs)} → ${d(report.totals.lastMs)} (${report.totals.spanDays}d)`);
console.log(`  ${report.totals.invoices} invoices · ${report.totals.customers} customers · $${report.totals.gross} gross · $${report.totals.avgTicket} avg ticket`);
console.log(`  repeat: ${report.totals.repeatCustomers}/${report.totals.customers} · discounted: ${report.totals.discountedInvoices} · strict-QR: ${report.totals.qrStrictInvoices}`);
console.log(`  item lines carrying a category tag: ${taggedItemLines}/${totalItemLines}`);

console.log(`\n--- reach by parameter (of ${customerIds.length} customers), best option each ---`);
for (const p of [...parameters].sort((a, b) => b.maxReach - a.maxReach || a.code.localeCompare(b.code))) {
  const note = p.blockedBy ? `  [${p.blockedBy}]` : "";
  console.log(
    `  ${String(p.maxReach).padStart(2)}/${customerIds.length}  ${p.code.padEnd(5)} ${p.tier.padEnd(9)} ${p.objective.padEnd(12)} ` +
      `${p.label.slice(0, 58).padEnd(58)} ${p.bestValue ? `best="${p.bestValue}"` : ""}${note}`
  );
}
console.log(`\nDataset → ${datasetPath(MERCHANT)}`);
console.log(`Report  → ${reportPath(MERCHANT)}`);
console.log(`\nNext: node scripts/run-campaign.mjs --param <CODE>=<value> [...] --discount 20 --cap 50`);
process.exit(0);
