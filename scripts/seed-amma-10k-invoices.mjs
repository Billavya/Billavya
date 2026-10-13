/**
 * Seeds 10,000 invoices for "Amma" specifically, using the real menu
 * (South Indian + North Indian, tagged Breakfast/Starters/Main
 * Course/Desserts/Drinks) so the campaign-parameter design work for the
 * Food category has real per-item-category signal to analyze — not just
 * invoice totals. Every line item carries `category`, matching the optional
 * `items[].category` field the campaign query builder's keyword/category
 * matching already reads (see hasKeywordMatch() in merchant-portal/index.html).
 *
 * Reuses the existing `profiles` pool (both real profiles and the ~400
 * "DEMO-" dummy ones from the earlier seed-10k-transactions.mjs run) as the
 * customer base — no new profiles are created here.
 *
 * Every invoice is tagged `isDummy: true` and given an `AMMA-SEED-` invoice
 * number prefix, so this stays clearly distinguishable from both real
 * Zoho-synced invoices (INV-000NNN) and the earlier generic seed batch.
 *
 * Usage: node scripts/seed-amma-10k-invoices.mjs
 */
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, writeBatch } from "firebase/firestore";

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

const TOTAL_INVOICES = 10000;
const MERCHANT_NAME = "Amma";
const MERCHANT_ADDRESS = "123 Placeholder Street, Toronto, ON M1A 1A1";

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function chance(p) { return Math.random() < p; }

// (name, category, unit, rate) — the real Amma menu
const MENU = {
  Breakfast: [
    ["Plain Dosa", "Plate", 8.99], ["Masala Dosa", "Plate", 10.99], ["Mysore Masala Dosa", "Plate", 11.99],
    ["Rava Dosa", "Plate", 10.99], ["Onion Uttapam", "Plate", 10.49], ["Idli (2 pcs)", "Plate", 7.49],
    ["Medu Vada (2 pcs)", "Plate", 7.49], ["Pongal", "Bowl", 8.49], ["Upma", "Bowl", 7.99], ["Idiyappam", "Plate", 8.99],
    ["Chole Bhature", "Plate", 11.99], ["Aloo Paratha with Curd", "Plate", 9.99], ["Poha", "Bowl", 7.49],
    ["Kachori with Sabzi", "Plate", 8.49], ["Paneer Paratha", "Plate", 10.49],
  ],
  Starters: [
    ["Mysore Bonda (4 pcs)", "Plate", 7.99], ["Banana Chips", "Bowl", 5.99], ["Masala Vada (3 pcs)", "Plate", 6.99],
    ["Pepper Chicken Fry", "Plate", 12.99], ["Gobi 65", "Plate", 10.99],
    ["Paneer Tikka", "Plate", 13.99], ["Chicken Tikka", "Plate", 14.99], ["Seekh Kebab (4 pcs)", "Plate", 13.49],
    ["Aloo Tikki Chaat (2 pcs)", "Plate", 8.99], ["Tandoori Chicken (Half)", "Piece", 15.99], ["Samosa (2 pcs)", "Piece", 5.99],
  ],
  "Main Course": [
    ["South Indian Thali", "Plate", 16.99], ["Sambar Rice", "Bowl", 11.99], ["Curd Rice", "Bowl", 9.99],
    ["Bisi Bele Bath", "Bowl", 12.49], ["Rasam Rice", "Bowl", 10.49], ["Chettinad Chicken Curry", "Plate", 15.99],
    ["Kerala Fish Curry", "Plate", 16.49], ["Lemon Rice", "Bowl", 9.49],
    ["Butter Chicken", "Plate", 17.99], ["Dal Makhani", "Bowl", 13.49], ["Paneer Butter Masala", "Plate", 15.99],
    ["Shahi Paneer", "Plate", 15.99], ["Kadai Paneer", "Plate", 15.49], ["Rajma Chawal", "Bowl", 12.99],
    ["Chicken Biryani", "Plate", 16.99], ["Mutton Rogan Josh", "Plate", 18.99], ["Palak Paneer", "Plate", 14.99],
    ["Tandoori Roti", "Piece", 2.49], ["Butter Naan", "Piece", 3.49], ["Garlic Naan", "Piece", 3.99], ["Jeera Rice", "Bowl", 6.99],
  ],
  Desserts: [
    ["Payasam", "Bowl", 5.99], ["Mysore Pak (2 pcs)", "Piece", 4.99], ["Rava Kesari", "Bowl", 5.49],
    ["Gulab Jamun (2 pcs)", "Piece", 4.99], ["Rasmalai (2 pcs)", "Piece", 5.99], ["Kheer", "Bowl", 5.49], ["Jalebi", "Plate", 4.99],
  ],
  Drinks: [
    ["Filter Coffee", "Cup", 3.99], ["Masala Chai", "Cup", 3.49], ["Buttermilk (Majjige)", "Glass", 3.99],
    ["Tender Coconut Water", "Glass", 5.99], ["Sweet Lassi", "Glass", 5.49], ["Mango Lassi", "Glass", 5.99],
    ["Thandai", "Glass", 5.49], ["Nimbu Pani", "Glass", 3.99],
  ],
};

function lineItem(category) {
  const [name, unit, rate] = pick(MENU[category]);
  const qty = randInt(1, 2);
  const amount = Math.round(qty * rate * 100) / 100;
  return { name, category, unit, qty, amount, variant: null };
}

// Builds a realistic order: an anchor (Breakfast or Main Course or Starters),
// then independent chances of adding a Starter, a Drink, and/or a Dessert —
// so Drinks/Desserts show up as genuine attach-rate signal, not as the
// entire order, matching how people actually order at a restaurant.
function genOrder() {
  const items = [];
  const anchorRoll = Math.random();
  if (anchorRoll < 0.3) {
    items.push(lineItem("Breakfast"));
  } else if (anchorRoll < 0.85) {
    items.push(lineItem("Main Course"));
    if (chance(0.3)) items.push(lineItem("Main Course")); // e.g. curry + extra naan/rice
  } else {
    items.push(lineItem("Starters"));
  }
  if (chance(0.25)) items.push(lineItem("Starters"));
  if (chance(0.5)) items.push(lineItem("Drinks"));
  if (chance(0.3)) items.push(lineItem("Desserts"));

  const subtotal = Math.round(items.reduce((s, it) => s + it.amount, 0) * 100) / 100;
  return { items, subtotal };
}

async function main() {
  console.log("Fetching existing profile pool (real + dummy)...");
  const profSnap = await getDocs(collection(db, "profiles"));
  const avyayaIds = profSnap.docs.map((d) => d.data().avyayaId).filter(Boolean);
  if (avyayaIds.length === 0) throw new Error("No profiles found to assign invoices to.");
  console.log(`Found ${avyayaIds.length} profiles to draw customers from.`);

  const now = Date.now();
  const SIX_MONTHS_MS = 182 * 86400000;

  console.log(`Generating ${TOTAL_INVOICES} invoices for ${MERCHANT_NAME}...`);
  let batch = writeBatch(db);
  let batchN = 0;
  let written = 0;

  for (let i = 0; i < TOTAL_INVOICES; i++) {
    const avyayaId = pick(avyayaIds);
    const { items, subtotal } = genOrder();
    const createdAtMs = now - randInt(0, SIX_MONTHS_MS);
    const orderType = pick(["Dine-in", "Takeaway", "Delivery"]);

    const invoiceDoc = {
      avyayaId,
      folder: "Food",
      country: "Canada",
      merchant: MERCHANT_NAME,
      merchantAddress: MERCHANT_ADDRESS,
      orderType,
      items, // real Firestore array, each item carries `category`
      subtotal,
      total: subtotal,
      tax: 0,
      discount: 0,
      createdAtMs,
      date: new Date(createdAtMs).toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " · " + new Date(createdAtMs).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      invoiceNo: "AMMA-SEED-" + String(i + 1).padStart(5, "0"),
      isDummy: true,
    };

    batch.set(doc(collection(db, "invoices")), invoiceDoc);
    batchN++;
    written++;
    if (batchN >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      batchN = 0;
      if (written % 1000 === 0) console.log(`  ${written} / ${TOTAL_INVOICES} invoices written...`);
    }
  }
  if (batchN > 0) await batch.commit();

  console.log(`Done — ${written} invoices written for ${MERCHANT_NAME} across ${avyayaIds.length} customers.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
