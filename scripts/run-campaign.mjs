/**
 * Runs a campaign against the prepared dataset and (optionally) pushes offers.
 *
 * Matching uses the SAME engine the merchant portal uses (lifted at load time
 * by campaign-engine.mjs), and the offer documents written here are the same
 * shape pushOffers() writes in the portal — so an offer sent from this script
 * is indistinguishable, to the app, from one sent through the paid flow.
 *
 * DRY RUN BY DEFAULT. Nothing is written unless you pass --push.
 *
 *   # see who matches, write nothing
 *   node scripts/run-campaign.mjs --param LAP="30 days" --discount 20 --cap 50
 *
 *   # several parameters, ANDed (a customer must satisfy all of them)
 *   node scripts/run-campaign.mjs --param QCK=">50% single-item" --param CAT="Desserts" --discount 15
 *
 *   # one separate offer per parameter instead of one ANDed audience
 *   node scripts/run-campaign.mjs --param LAP="30 days" --param DAY=Friday --mode each
 *
 *   # actually send
 *   node scripts/run-campaign.mjs --param LAP="30 days" --discount 20 --cap 50 --push
 *
 * Options:
 *   --param CODE=value   repeatable. CODE is the short code from the report
 *                        (LAP, CAT, QCK, …). Value must be one of that
 *                        parameter's options; amounts are plain numbers.
 *   --mode and|each      and (default) = one audience matching every parameter.
 *                        each = one independent campaign per parameter.
 *   --discount N         percent off (default 10)
 *   --cap N              max discount amount (default 100)
 *   --until YYYY-MM-DD   offer end date (default: 14 days out)
 *   --merchant "Name"    default: Naanna Restaurant
 *   --push               write the offers. Without this, nothing is written.
 */
import fs from "fs";
import { collection, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { firestore, loadEngine, allCriteria, ltvQualifiers, evaluateFor, datasetPath, generateDiscountCode } from "./campaign-engine.mjs";

// ---- args -------------------------------------------------------------------
const argv = process.argv.slice(2);
const params = [];
let mode = "and", discountPct = 10, capAmount = 100, until = null, merchantName = "Naanna Restaurant", push = false;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const next = () => {
    const v = argv[++i];
    if (v === undefined) throw new Error(`${a} needs a value`);
    return v;
  };
  if (a === "--param") {
    const raw = next();
    const eq = raw.indexOf("=");
    if (eq < 1) throw new Error(`--param must look like CODE=value, got "${raw}"`);
    params.push({ code: raw.slice(0, eq).trim().toUpperCase(), value: raw.slice(eq + 1).trim() });
  } else if (a === "--mode") mode = next();
  else if (a === "--discount") discountPct = Number(next());
  else if (a === "--cap") capAmount = Number(next());
  else if (a === "--until") until = next();
  else if (a === "--merchant") merchantName = next();
  else if (a === "--push") push = true;
  else throw new Error(`Unknown argument "${a}"`);
}
if (!params.length) throw new Error("Pass at least one --param CODE=value. Run scripts/campaign-dataset.mjs to see the codes.");
if (!["and", "each"].includes(mode)) throw new Error(`--mode must be "and" or "each"`);
if (!Number.isFinite(discountPct) || discountPct <= 0 || discountPct > 100) throw new Error("--discount must be 1-100");

// ---- dataset ----------------------------------------------------------------
const dpath = datasetPath(merchantName);
if (!fs.existsSync(dpath)) throw new Error(`No dataset at ${dpath}. Run: node scripts/campaign-dataset.mjs "${merchantName}"`);
const ds = JSON.parse(fs.readFileSync(dpath, "utf8"));
const ageHours = (Date.now() - ds.builtAtMs) / 3600000;
console.log(`Dataset: ${ds.invoicesAtMerchant.length} invoices · ${ds.customerIds.length} customers · built ${ageHours < 1 ? "just now" : `${ageHours.toFixed(1)}h ago`}`);
if (ageHours > 24) console.log(`  NOTE: more than a day old — sales since then are not in it. Re-run campaign-dataset.mjs to refresh.`);

const engine = loadEngine();
const criteria = allCriteria(engine, ds.category);
const byCode = new Map(criteria.map((c) => [c.code, c]));

// ---- resolve + validate the submitted parameters ----------------------------
const selected = params.map(({ code, value }) => {
  const c = byCode.get(code);
  if (!c) throw new Error(`Unknown parameter code "${code}". Valid: ${[...byCode.keys()].join(", ")}`);
  // Accept an exact option, or a forgiving match (case / partial), so
  // --param LAP=30 works as well as --param LAP="30 days".
  let resolved = c.values.find((v) => v.toLowerCase() === value.toLowerCase());
  if (!resolved) {
    const hits = c.values.filter((v) => v.toLowerCase().includes(value.toLowerCase()) || v.replace(/[^\d.]/g, "") === value.replace(/[^\d.]/g, ""));
    if (hits.length === 1) resolved = hits[0];
    else throw new Error(`"${value}" is not a valid value for ${code}. Options: ${c.values.join(" | ")}`);
  }
  return { criterion: c, code, value: resolved, label: c.label, discountPct, capAmount };
});

console.log(`\nParameters (${mode === "and" ? "ANDed into one audience" : "one campaign each"}):`);
for (const s of selected) console.log(`  ${s.code.padEnd(5)} ${s.label}\n        = "${s.value}"`);

// ---- match ------------------------------------------------------------------
const mineByCustomer = engine.buildCustomerIndex(ds.invoicesAtMerchant);
const ltvSets = new Map();
for (const s of selected) {
  if (s.criterion.isGlobalRanking) ltvSets.set(`${s.code}|${s.value}`, ltvQualifiers(s.value, mineByCustomer));
}

function audienceFor(sel) {
  const matched = [];
  const skipped = new Set();
  for (const id of ds.customerIds) {
    const scopes = { mine: mineByCustomer[id] || [], all: ds.invoicesByCustomerAllMerchants[id] || [] };
    let ok = true;
    for (const s of sel) {
      const r = evaluateFor(engine, s.criterion, s.value, id, scopes, ds.profiles[id], ds.merchant.city, ltvSets);
      // null = this rule can't be computed from today's data. The portal
      // treats that as "skip the rule", not "exclude the customer" — same here.
      if (r === null) { skipped.add(s.label); continue; }
      if (!r) { ok = false; break; }
    }
    if (ok) matched.push(id);
  }
  return { matched, skipped: [...skipped] };
}

const runs = mode === "and" ? [{ sel: selected }] : selected.map((s) => ({ sel: [s] }));
const results = runs.map((r) => ({ ...r, ...audienceFor(r.sel) }));

// ---- offer documents --------------------------------------------------------
const DAY_MS = 86400000;
const expMs = until ? new Date(`${until}T23:59:59`).getTime() : Date.now() + 14 * DAY_MS;
if (!Number.isFinite(expMs)) throw new Error(`--until must be YYYY-MM-DD, got "${until}"`);
const expLabel = "Ends " + new Date(expMs).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const nowMs = Date.now();
const mapsUrl = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(ds.merchant.address || ds.merchant.businessName);

// Campaign number: continue this merchant's existing sequence.
const db = firestore();
let campaignNumber = 1;
if (ds.merchant.email) {
  try {
    const csnap = await getDocs(query(collection(db, "campaigns"), where("merchantEmail", "==", ds.merchant.email)));
    campaignNumber = csnap.size + 1;
  } catch { /* non-fatal — default to 01 */ }
}

function minSpendFor(sel) {
  const c = sel.find((s) => s.criterion.isMinSpendSource);
  if (!c) return null;
  const n = Number(String(c.value).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const plans = results.map((r, i) => {
  const code = generateDiscountCode(ds.merchant.businessName, campaignNumber, i + 1);
  return {
    ...r,
    code,
    offer: {
      country: ds.merchant.country,
      folder: ds.merchant.category,
      pct: `${discountPct}% OFF`,
      merchant: ds.merchant.businessName,
      desc: "Automated campaign match",
      exp: expLabel,
      campaignTier: "manual",
      criterion: r.sel.map((s) => `${s.label}: ${s.value}`).join(" · "),
      code,
      minSpend: minSpendFor(r.sel),
      capAmount,
      createdAtMs: nowMs,
      activated: true,
      activatedAtMs: nowMs,
      expiresAtMs: expMs,
      merchantAddress: ds.merchant.address || "",
      locationMapUrl: mapsUrl,
    },
  };
});

// ---- report -----------------------------------------------------------------
console.log(`\n--- audience (of ${ds.customerIds.length} customers) ---`);
let totalOffers = 0;
for (const p of plans) {
  console.log(`\n  ${p.sel.map((s) => `${s.code}="${s.value}"`).join(" AND ")}`);
  console.log(`    matched: ${p.matched.length}   code: ${p.code}   ${discountPct}% off, cap ${p.offer.capAmount}${p.offer.minSpend ? `, min spend ${p.offer.minSpend}` : ""}`);
  if (p.skipped.length) console.log(`    skipped (not trackable, did not exclude anyone): ${p.skipped.join("; ")}`);
  for (const id of p.matched) {
    const c = (mineByCustomer[id] || []);
    const spend = c.reduce((s, r) => s + (Number(r.total) || 0), 0);
    const last = engine.mostRecent(c);
    console.log(`      ${id}  ${String(c.length).padStart(2)} visits  $${spend.toFixed(2).padStart(8)}  last ${last ? Math.floor((Date.now() - last) / DAY_MS) + "d ago" : "?"}`);
  }
  if (!p.matched.length) console.log(`      (nobody — no offers would be sent for this parameter)`);
  totalOffers += p.matched.length;
}

console.log(`\n  TOTAL OFFERS: ${totalOffers}   valid until ${new Date(expMs).toISOString().slice(0, 10)}`);
console.log(`\n  offer document that would be written (first match):`);
console.log(JSON.stringify({ avyayaId: plans.find((p) => p.matched.length)?.matched[0] ?? "(none)", ...plans[0].offer }, null, 2).split("\n").map((l) => "    " + l).join("\n"));

// ---- push -------------------------------------------------------------------
if (!push) {
  console.log(`\nDRY RUN — nothing was written. Re-run with --push to send these ${totalOffers} offer(s).`);
  process.exit(0);
}
if (!totalOffers) {
  console.log(`\nNothing to push (no matches).`);
  process.exit(0);
}

let batch = writeBatch(db);
let ops = 0, written = 0;
for (const p of plans) {
  for (const avyayaId of p.matched) {
    batch.set(doc(collection(db, "offers")), { avyayaId, ...p.offer });
    ops++; written++;
    if (ops >= 450) { await batch.commit(); batch = writeBatch(db); ops = 0; }
  }
}
if (ops) await batch.commit();
console.log(`\nPUSHED ${written} offer(s) to the offers collection. They are activated — they appear in each customer's app immediately.`);
process.exit(0);
