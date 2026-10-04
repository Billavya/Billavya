/**
 * One-off/reusable seed script: pushes realistic demo invoices straight into
 * the live `invoices` Firestore collection for a list of Avyaya IDs — the
 * exact same collection and field shape the real POS web apps
 * (pos-web/index.html, pos-web-grocery/index.html) write to, so the app
 * renders these exactly like real pushed invoices.
 *
 * Usage:
 *   node scripts/seed-demo-invoices.mjs
 *     -> seeds the default ID list below, 10 invoices per folder each.
 *   node scripts/seed-demo-invoices.mjs AVY-XXXX-XXXX,AVY-YYYY-YYYY 10-12
 *     -> seeds just the given comma-separated IDs, a random 10-12
 *        invoices per folder for each (or a fixed count instead of a range).
 *   node scripts/seed-demo-invoices.mjs AVY-XXXX-XXXX 6 0-1
 *     -> a 3rd arg controls how many days ago each invoice is dated
 *        (default: a realistic 0-60 day spread). "0-1" makes every seeded
 *        invoice land today or yesterday, so it shows up immediately in the
 *        app's "Latest Bills" section instead of being buried among older
 *        invoices. Also accepts a single fixed number of days.
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

const [idsArg, countArg, daysAgoArg] = process.argv.slice(2);

// These are real, already-existing account IDs from earlier testing. They
// originally kept a legacy "SNB-" (SnapBill) prefix, but every such ID was
// migrated to "AVY-" across profiles/invoices/offers on 2026-10-04 (see
// scripts/migrate-snb-to-avy.mjs) — there is no longer any live "SNB-" data,
// so every ID below uses the current "AVY-" prefix too.
const AVYAYA_IDS = idsArg
  ? idsArg.split(",").map((s) => s.trim()).filter(Boolean)
  : [
      "AVY-MHN4-PRNG",
      "AVY-ZBSP-E93S",
      "AVY-MZDQ-BTXJ",
      "AVY-MLBQ-DTQU",
      "AVY-5TZD-KSX9",
      "AVY-EHFD-C527",
    ];

/** Returns how many invoices to write for one (id, folder) pair — a fixed
 *  count, or a fresh random pick from a "min-max" range, per call. */
function resolveCountPerFolder() {
  if (!countArg) return () => 10;
  if (countArg.includes("-")) {
    const [lo, hi] = countArg.split("-").map(Number);
    return () => randInt(lo, hi);
  }
  const n = Number(countArg);
  return () => n;
}

// ---- Food: merchants + menu, mirroring pos-web/index.html's real shape ----
const FOOD_MERCHANTS = [
  { name: "Spice Route Kitchen", address: "142, MG Road, Indiranagar, Bengaluru, Karnataka 560038", gstin: "29ABCDE1234F1Z5" },
  { name: "Meghana Foods", address: "3rd Block, Koramangala, Bengaluru, Karnataka 560034", gstin: "29MEGHF5678K1Z2" },
  { name: "Truffles", address: "12th Main, Indiranagar, Bengaluru, Karnataka 560038", gstin: "29TRUFL9012L1Z9" },
  { name: "Chaayos", address: "Forum Mall, Koramangala, Bengaluru, Karnataka 560095", gstin: "29CHAAY3456M1Z4" },
  { name: "Domino's Pizza", address: "100 Feet Road, HSR Layout, Bengaluru, Karnataka 560102", gstin: "29DOMIN7890N1Z1" },
  // The real registered restaurant merchant (campaign-restaurant/index.html)
  // — included here so seeded invoices sometimes land under the same
  // merchant name a pushed campaign offer uses, letting the app's
  // eligibility banner (src/utils/offerEligibility.ts) actually match.
  { name: "Vindu Restaurant", address: "48, Residency Road, Bengaluru, Karnataka 560025", gstin: "29VINDU4561P1Z6" },
];
const FOOD_MENU = [
  { name: "Paneer Tikka", price: 280 },
  { name: "Chicken 65", price: 320 },
  { name: "Veg Spring Roll", price: 210 },
  { name: "Mutton Seekh Kebab", price: 360 },
  { name: "Butter Chicken", price: 420 },
  { name: "Paneer Butter Masala", price: 360 },
  { name: "Dal Makhani", price: 280 },
  { name: "Butter Naan", price: 40 },
  { name: "Garlic Naan", price: 55 },
  { name: "Chicken Biryani", price: 280 },
  { name: "Veg Biryani", price: 220 },
  { name: "Sweet Lassi", price: 120 },
  { name: "Gulab Jamun", price: 120 },
  { name: "Cold Coffee", price: 150 },
  { name: "Masala Tea", price: 50 },
];
const FOOD_ORDER_TYPES = ["Dine-in", "Dine-in", "Takeaway", "Delivery"];

// ---- Groceries: merchants + menu, mirroring pos-web-grocery/index.html ----
const GROCERY_MERCHANTS = [
  { name: "FreshMart Grocers", address: "27, 4th Block, Jayanagar, Bengaluru, Karnataka 560011", gstin: "29FMGRO1234C1Z7" },
  { name: "Nature's Basket", address: "5th Cross, Malleshwaram, Bengaluru, Karnataka 560003", gstin: "29NATBA5678D1Z3" },
  { name: "More Supermarket", address: "80 Feet Road, Rajajinagar, Bengaluru, Karnataka 560010", gstin: "29MORES9012E1Z8" },
  { name: "Reliance Fresh", address: "Bannerghatta Road, Bengaluru, Karnataka 560076", gstin: "29RELFR3456F1Z5" },
  { name: "Namdhari's Fresh", address: "Sarjapur Road, Bengaluru, Karnataka 560035", gstin: "29NAMDH7890G1Z2" },
];
const GROCERY_MENU = [
  { name: "Basmati Rice (5 kg)", price: 650 },
  { name: "Toor Dal (1 kg)", price: 160 },
  { name: "Sunflower Oil (1 L)", price: 180 },
  { name: "Wheat Atta (5 kg)", price: 240 },
  { name: "Sugar (1 kg)", price: 48 },
  { name: "Iodised Salt (1 kg)", price: 22 },
  { name: "Full Cream Milk (1 L)", price: 66 },
  { name: "Brown Eggs (6 pcs)", price: 54 },
  { name: "Bread Loaf (400 g)", price: 45 },
  { name: "Bananas (1 dozen)", price: 60 },
  { name: "Tomatoes (1 kg)", price: 40 },
  { name: "Onions (1 kg)", price: 35 },
  { name: "Potatoes (1 kg)", price: 30 },
  { name: "Lay's Chips (90 g)", price: 20 },
  { name: "Parle-G Biscuits (200 g)", price: 25 },
  { name: "Tata Tea Gold (250 g)", price: 140 },
  { name: "Nescafé Coffee (100 g)", price: 220 },
  { name: "Real Fruit Juice (1 L)", price: 120 },
];
const GROCERY_ORDER_TYPES = ["Walk-in", "Walk-in", "Home Delivery"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Same display format as the POS apps' nowLabel(), but for an arbitrary past timestamp. */
function dateLabel(ms) {
  const d = new Date(ms);
  let h = d.getHours();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${h}:${String(d.getMinutes()).padStart(2, "0")} ${ap}`;
}

/** How far back a seeded invoice's date can land — defaults to the original
 *  ~60-day realistic spread, but a 3rd CLI arg ("0-1" for today/yesterday
 *  only, e.g. so seeded invoices actually show up in the app's "Latest
 *  Bills" section right away) overrides it. Same "min-max" or fixed-number
 *  format as the count argument. */
function resolveDaysAgoRange() {
  if (!daysAgoArg) return [0, 60];
  if (daysAgoArg.includes("-")) return daysAgoArg.split("-").map(Number);
  const n = Number(daysAgoArg);
  return [n, n];
}
const [DAYS_AGO_MIN, DAYS_AGO_MAX] = resolveDaysAgoRange();

/** A random moment within the configured day range, at a plausible meal/shopping hour. */
function randomPastTimestamp() {
  const daysAgo = randInt(DAYS_AGO_MIN, DAYS_AGO_MAX);
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(randInt(8, 21), randInt(0, 59), 0, 0);
  return d.getTime();
}

function buildInvoice(avyayaId, folder) {
  const isFood = folder === "Food";
  const merchant = pick(isFood ? FOOD_MERCHANTS : GROCERY_MERCHANTS);
  const menu = isFood ? FOOD_MENU : GROCERY_MENU;
  const orderType = pick(isFood ? FOOD_ORDER_TYPES : GROCERY_ORDER_TYPES);

  const itemCount = randInt(2, 6);
  const chosen = new Set();
  while (chosen.size < itemCount && chosen.size < menu.length) {
    chosen.add(pick(menu));
  }
  const items = Array.from(chosen).map((m) => {
    const qty = randInt(1, 3);
    return { name: m.name, variant: null, qty, unit: m.price, amount: m.price * qty };
  });

  const subtotal = items.reduce((sum, it) => sum + it.amount, 0);
  const discount = Math.random() < 0.25 ? Math.round(subtotal * (randInt(5, 15) / 100)) : 0;
  const taxable = subtotal - discount;
  const tax = Math.round(taxable * 0.05);
  const total = taxable + tax;

  const createdAtMs = randomPastTimestamp();

  return {
    avyayaId,
    // Also written under the old field name — the rolled-back SnapBill app
    // (a pre-rename checkpoint, currently in active use as a stopgap while
    // Avyaya's native crash is unresolved) still queries invoices by
    // "snapbillId", not "avyayaId". Without this, anything freshly seeded is
    // invisible to that app even though it's invisible to nothing else.
    // Same value either way — remove once that stopgap is no longer needed.
    snapbillId: avyayaId,
    folder,
    merchant: merchant.name,
    merchantAddress: merchant.address,
    gstin: merchant.gstin,
    date: dateLabel(createdAtMs),
    createdAtMs,
    invoiceNo: "SB-" + randInt(10000, 99999),
    table: isFood ? `Table ${randInt(1, 20)}` : `Counter ${randInt(1, 3)}`,
    orderType,
    items,
    subtotal,
    discount,
    tax,
    total,
  };
}

async function main() {
  const countPerFolder = resolveCountPerFolder();
  let written = 0;
  const failures = [];

  for (const avyayaId of AVYAYA_IDS) {
    for (const folder of ["Food", "Groceries"]) {
      const n = countPerFolder();
      for (let i = 0; i < n; i++) {
        const record = buildInvoice(avyayaId, folder);
        try {
          const ref = await addDoc(collection(db, "invoices"), record);
          written += 1;
          console.log(`✓ ${avyayaId} · ${folder} · ${record.merchant} · ₹${record.total} · ${ref.id}`);
        } catch (err) {
          failures.push({ avyayaId, folder, error: String(err) });
          console.error(`✗ FAILED ${avyayaId} · ${folder}:`, err);
        }
      }
    }
  }

  console.log(`\nDone. Wrote ${written} invoices.`);
  if (failures.length) {
    console.error(`${failures.length} FAILED — see above.`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exitCode = 1;
});
