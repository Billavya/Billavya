/**
 * Reusable seed script: pushes realistic demo offers straight into the live
 * `offers` Firestore collection — the same collection and field shape a real
 * merchant campaign (campaign-groceries, or the "Reach Your Customers"
 * builder) writes to, so the app renders these exactly like real pushed
 * offers (see src/services/offers.ts's LiveOffer, and OfferDetailModal.tsx).
 *
 * Usage:
 *   node scripts/seed-demo-offers.mjs
 *     -> seeds the default ID list below, 10 offers per folder each.
 *   node scripts/seed-demo-offers.mjs AVY-XXXX-XXXX,AVY-YYYY-YYYY 10-12
 *     -> seeds just the given comma-separated IDs, a random 10-12 offers
 *        per folder for each (or a fixed count instead of a range).
 *   node scripts/seed-demo-offers.mjs AVY-XXXX-XXXX 6 3
 *     -> a fresh "just launched" campaign: 6 offers per folder, all
 *        NOT yet activated (so the customer discovers them fresh in the
 *        app), created "now", expiring in exactly 3 days (the trailing
 *        arg) instead of the usual randomized "Ends in N days" spread.
 *   node scripts/seed-demo-offers.mjs "AVY-A,AVY-B" 4 7 "FreshMart Grocers" Groceries
 *     -> same fresh-campaign behavior, but ALL offers come from the named
 *        merchant (skips the random merchant pool) and only the given
 *        folder is seeded, instead of both Food and Groceries — for a real
 *        single-merchant campaign like campaign-groceries would run.
 */
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC_-oQ0MY2anXHrD_Bm-4-exLmHRZb4Apk",
  authDomain: "letsgetdirty.firebaseapp.com",
  projectId: "letsgetdirty",
  storageBucket: "letsgetdirty.firebasestorage.app",
  messagingSenderId: "877273017008",
  appId: "1:877273017008:web:e2e643c331701fd33de975",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const [idsArg, countArg, validDaysArg, forcedMerchantArg, folderArg] = process.argv.slice(2);
const VALID_DAYS = validDaysArg ? Number(validDaysArg) : null;
const FOLDERS_TO_SEED = folderArg ? [folderArg] : ["Food", "Groceries"];

// Real, already-existing account IDs — kept at their original "SNB-" prefix
// permanently, same note as scripts/seed-demo-invoices.mjs.
const AVYAYA_IDS = idsArg
  ? idsArg.split(",").map((s) => s.trim()).filter(Boolean)
  : [
      "SNB-MHN4-PRNG",
      "SNB-ZBSP-E93S",
      "SNB-MZDQ-BTXJ",
      "SNB-MLBQ-DTQU",
      "SNB-5TZD-KSX9",
      "SNB-EHFD-C527",
    ];

function resolveCountPerFolder() {
  if (!countArg) return () => 10;
  if (countArg.includes("-")) {
    const [lo, hi] = countArg.split("-").map(Number);
    return () => randInt(lo, hi);
  }
  const n = Number(countArg);
  return () => n;
}

// Same merchant pools as scripts/seed-demo-invoices.mjs, so an offer and an
// invoice for the same test ID can plausibly be from the same merchant.
const FOOD_MERCHANTS = ["Spice Route Kitchen", "Meghana Foods", "Truffles", "Chaayos", "Domino's Pizza"];
const GROCERY_MERCHANTS = ["FreshMart Grocers", "Nature's Basket", "More Supermarket", "Reliance Fresh", "Namdhari's Fresh"];

const CAMPAIGN_TIERS = ["Loyalty", "Win-back", "Top Spender", "New Arrival", "Frequency Reward"];
const EXP_LABELS = ["Ends in 3 days", "Ends in 5 days", "Ends in 7 days", "Ends in 10 days", "Ends in 2 weeks"];

const FOOD_TEMPLATES = [
  { pct: "FREE DELIVERY", desc: "Free delivery on your next order, whenever you'd rather stay in.", criterion: "You've ordered delivery from us before — thought you'd like this." },
  { pct: "30% OFF", desc: "Reserved for our top spenders — 30% off plus priority seating.", criterion: "You're in our top 10% of spenders this month." },
  { pct: "FREE ADD-ON", desc: "A dish you loved before, now with a free side of your choice.", criterion: "Based on what you ordered last time." },
  { pct: "10% OFF", desc: "Great having you back recently — 10% off your next visit.", criterion: "You visited twice in the last 2 weeks." },
  { pct: "20% OFF", desc: "You've been one of our top regulars this month — here's a thank-you.", criterion: "5+ visits this month." },
  { pct: "15% OFF", desc: "It's been a while — come back and enjoy 15% off your next order.", criterion: "No visits in the last 30 days." },
  { pct: "FREE ITEM", desc: "Try something new on us — a free item with any order above ₹300.", criterion: "You haven't tried our new menu yet." },
  { pct: "5% CASHBACK", desc: "Extra 5% back as Avyaya credit on this visit.", criterion: "Loyalty reward for frequent shoppers." },
];
const GROCERY_TEMPLATES = [
  { pct: "FREE DELIVERY", desc: "Free home delivery on your next grocery order.", criterion: "You've shopped with us 3+ times this month." },
  { pct: "10% OFF", desc: "10% off your next basket over ₹1,000.", criterion: "Your average basket size qualifies you for this." },
  { pct: "FREE ITEM", desc: "A free pack of Parle-G with any order today.", criterion: "A little thank-you for your last visit." },
  { pct: "20% OFF", desc: "20% off fresh produce this week only.", criterion: "You buy fresh produce regularly." },
  { pct: "5% CASHBACK", desc: "5% back as Avyaya credit on this order.", criterion: "Loyalty reward for frequent shoppers." },
  { pct: "15% OFF", desc: "Haven't seen you in a while — 15% off to welcome you back.", criterion: "No visits in the last 3 weeks." },
  { pct: "BUY 1 GET 1", desc: "Buy one, get one free on select dairy items.", criterion: "Based on your recent dairy purchases." },
  { pct: "FREE DELIVERY", desc: "Free delivery this weekend on any order.", criterion: "You're a Home Delivery regular." },
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** A random moment in the last ~30 days — offers are newer than the 60-day invoice spread. */
function randomPastTimestamp() {
  const daysAgo = randInt(0, 30);
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(randInt(8, 21), randInt(0, 59), 0, 0);
  return d.getTime();
}

function buildOffer(avyayaId, folder) {
  const isFood = folder === "Food";
  const merchant = forcedMerchantArg || pick(isFood ? FOOD_MERCHANTS : GROCERY_MERCHANTS);
  const template = pick(isFood ? FOOD_TEMPLATES : GROCERY_TEMPLATES);

  // A fresh campaign (VALID_DAYS given): launched "now", nobody's activated
  // it yet — that's the customer's own next move in the app. Otherwise, keep
  // the old randomized-history behavior for general demo seeding.
  const isFreshCampaign = VALID_DAYS != null;
  const createdAtMs = isFreshCampaign ? Date.now() - randInt(0, 3600_000) : randomPastTimestamp();
  const activated = isFreshCampaign ? false : Math.random() < 0.5;
  const exp = isFreshCampaign ? `Ends in ${VALID_DAYS} day${VALID_DAYS === 1 ? "" : "s"}` : pick(EXP_LABELS);
  const expiresAtMs = isFreshCampaign ? createdAtMs + VALID_DAYS * 24 * 3600_000 : null;

  return {
    avyayaId,
    country: "India",
    // Also written under the old field name — see the matching note in
    // seed-demo-invoices.mjs. Remove once the SnapBill pre-rename stopgap
    // is no longer in use.
    snapbillId: avyayaId,
    folder,
    merchant,
    pct: template.pct,
    desc: template.desc,
    criterion: template.criterion,
    exp,
    expiresAtMs,
    campaignTier: pick(CAMPAIGN_TIERS),
    createdAtMs,
    activated,
    activatedAtMs: activated ? createdAtMs + randInt(1, 5) * 3600_000 : null,
  };
}

async function main() {
  const countPerFolder = resolveCountPerFolder();
  let written = 0;
  const failures = [];

  for (const avyayaId of AVYAYA_IDS) {
    for (const folder of FOLDERS_TO_SEED) {
      const n = countPerFolder();
      for (let i = 0; i < n; i++) {
        const record = buildOffer(avyayaId, folder);
        try {
          const ref = await addDoc(collection(db, "offers"), record);
          written += 1;
          console.log(`✓ ${avyayaId} · ${folder} · ${record.merchant} · ${record.pct} · ${ref.id}`);
        } catch (err) {
          failures.push({ avyayaId, folder, error: String(err) });
          console.error(`✗ FAILED ${avyayaId} · ${folder}:`, err);
        }
      }
    }
  }

  console.log(`\nDone. Wrote ${written} offers.`);
  if (failures.length) {
    console.error(`${failures.length} FAILED — see above.`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exitCode = 1;
});
