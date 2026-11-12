/**
 * Shared plumbing for the Clover sales → campaign pipeline.
 *
 * THE ONE IMPORTANT IDEA HERE: this module does not reimplement any campaign
 * matching rule. It lifts the real CRITERIA_DATA table and every evaluate()
 * function straight out of merchant-portal/index.html and evals them, so the
 * audience this pipeline computes is the audience the live builder computes.
 * Change a rule in the portal and this follows it — there is no second copy
 * to drift out of sync.
 *
 * Extraction is anchored on code markers, not fixed line numbers, so ordinary
 * edits to the portal don't silently break it. If a marker ever disappears the
 * load throws loudly rather than returning a half-built engine.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Datasets live OUTSIDE the repo on purpose: snapbill-expo is a public GitHub
// repo (it also serves billavya.com), and a prepared dataset contains real
// customer Avyaya IDs and spend history. Nothing here is ever committable.
export const DATA_ROOT = path.join(os.homedir(), "avyaya-campaign-data");

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC_-oQ0MY2anXHrD_Bm-4-exLmHRZb4Apk",
  authDomain: "letsgetdirty.firebaseapp.com",
  projectId: "letsgetdirty",
  storageBucket: "letsgetdirty.firebasestorage.app",
  messagingSenderId: "877273017008",
  appId: "1:877273017008:web:e2e643c331701fd33de975",
};

export function firestore() {
  return getFirestore(initializeApp(FIREBASE_CONFIG));
}

export function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
export function datasetDir(merchant) {
  return path.join(DATA_ROOT, slug(merchant));
}
export function datasetPath(merchant) {
  return path.join(datasetDir(merchant), "dataset.json");
}
export function reportPath(merchant) {
  return path.join(datasetDir(merchant), "report.json");
}

// ---------------------------------------------------------------------------
// Engine extraction
// ---------------------------------------------------------------------------
const PORTAL = path.join(import.meta.dirname, "..", "merchant-portal", "index.html");

function findLine(lines, needle, label) {
  const i = lines.findIndex((l) => l.includes(needle));
  if (i < 0) {
    throw new Error(
      `campaign-engine: could not find the ${label} marker (${JSON.stringify(needle)}) in merchant-portal/index.html. ` +
        `The portal was restructured — update the anchors in scripts/campaign-engine.mjs.`
    );
  }
  return i;
}

export function loadEngine() {
  const lines = fs.readFileSync(PORTAL, "utf8").split("\n");
  const take = (startNeedle, endNeedle, label) => {
    const a = findLine(lines, startNeedle, `${label} start`);
    const b = findLine(lines, endNeedle, `${label} end`);
    if (b <= a) throw new Error(`campaign-engine: ${label} markers are out of order.`);
    return lines.slice(a, b).join("\n");
  };

  const src = [
    // Option magnitudes, objective metadata, every *Evaluate(), CRITERIA_DATA.
    take("var AMOUNT_MAGNITUDES", "var CITY_OPTIONS_BY_COUNTRY", "criteria table"),
    // tierCriteria()
    take("function tierCriteria", "---- builder state", "tier helper"),
    // DAY_MS … buildCustomerIndex … evaluateCriterion
    take("const DAY_MS = 86400000", "function resolveMerchantCity", "matching helpers"),
  ].join("\n");

  const exported = [
    "CRITERIA_DATA", "tierCriteria", "evaluateCriterion", "buildCustomerIndex",
    "FOOD_CATEGORY_KEYWORDS", "GROCERY_AISLE_KEYWORDS", "invoiceItems", "itemsText",
    "hasCategoryTag", "hasKeywordMatch", "addonRate", "DAY_NAMES", "DAY_MS",
    "mostCommonDay", "mostCommonOrderType", "avgGap", "mostRecent", "earliest", "totalSpend",
    "OBJECTIVE_META", "AMOUNT_MAGNITUDES",
  ];
  const engine = new Function(`${src}\nreturn { ${exported.join(", ")} };`)();

  // Fail loudly if the lift produced something unusable, rather than quietly
  // reporting every parameter as unmatchable later on.
  if (!engine.CRITERIA_DATA?.Food?.basic?.length) {
    throw new Error("campaign-engine: CRITERIA_DATA came back empty — extraction anchors need review.");
  }
  return engine;
}

/**
 * The one rule the portal implements OUTSIDE evaluate(): "top spenders by
 * lifetime value" needs a cross-customer ranking, so its evaluate() returns
 * null and runQueryBuilder ranks separately. Mirrored here —
 * lifetime value AT THIS MERCHANT, ceil(n × pct), minimum 1, spenders only.
 *
 * ONE DELIBERATE DEVIATION from the portal: it parses the percentage with
 * parseInt(value, 10) against option labels that read "Top 5%" — which is
 * NaN, making the cutoff NaN and the qualifying set empty, so the live LTV
 * parameter currently matches nobody at all. Pulling the digits out of the
 * label instead is what that code was clearly meant to do, and is what makes
 * the reach numbers here truthful. The portal needs the same one-line fix.
 */
export function ltvQualifiers(value, mineByCustomer) {
  const totals = Object.entries(mineByCustomer)
    .map(([id, rows]) => ({ id, total: rows.reduce((s, i) => s + (Number(i.total) || 0), 0) }))
    .filter((t) => t.total > 0)
    .sort((a, b) => b.total - a.total);
  const digits = Number(String(value).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(digits) || digits <= 0) return new Set();
  const cutoff = Math.max(1, Math.ceil(totals.length * (digits / 100)));
  return new Set(totals.slice(0, cutoff).map((t) => t.id));
}

/**
 * Evaluates one criterion for one customer, transparently handling the LTV
 * ranking case. Returns true / false / null (null = not trackable today).
 */
export function evaluateFor(engine, criterion, value, id, scopes, profile, merchantCity, ltvSets) {
  if (criterion.isGlobalRanking) {
    const set = ltvSets.get(`${criterion.code}|${value}`);
    return set ? set.has(id) : null;
  }
  try {
    return engine.evaluateCriterion(criterion, value, scopes, profile || null, merchantCity);
  } catch {
    return null;
  }
}

/** Flattens a category's criteria with their tier, in the portal's own order. */
export function allCriteria(engine, category) {
  const data = engine.CRITERIA_DATA[category];
  if (!data) throw new Error(`Unknown category "${category}" — have: ${Object.keys(engine.CRITERIA_DATA).join(", ")}`);
  const basic = data.basic.length;
  const standard = basic + data.standard.length;
  return engine.tierCriteria(data, "premium").map((c, i) => ({
    ...c,
    tier: i < basic ? "basic" : i < standard ? "standard" : "premium",
    values: c.amounts ? c.amounts.map(String) : c.options || [],
  }));
}

/** The portal's discount-code format, reproduced so codes stay consistent. */
export function generateDiscountCode(businessName, campaignNumber, paramIndex, at = new Date()) {
  const alpha3 = (s) => String(s || "").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase().padEnd(3, "X");
  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const startOfYear = new Date(at.getFullYear(), 0, 1);
  const weekOfYear = Math.ceil(((at - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  return ["AVY", alpha3(businessName), MONTHS[at.getMonth()], String(weekOfYear), String(campaignNumber).padStart(2, "0"), String(paramIndex).padStart(2, "0")].join("-");
}
