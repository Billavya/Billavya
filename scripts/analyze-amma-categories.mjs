import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";

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

const snap = await getDocs(query(collection(db, "invoices"), where("merchant", "==", "Amma")));
console.log("Total Amma invoices:", snap.size);

const invoices = snap.docs.map((d) => d.data());

function hasCat(inv, cat) { return (inv.items || []).some((it) => it.category === cat); }

const mainCourseInvoices = invoices.filter((inv) => hasCat(inv, "Main Course"));
const withDrink = mainCourseInvoices.filter((inv) => hasCat(inv, "Drinks"));
const withDessert = mainCourseInvoices.filter((inv) => hasCat(inv, "Desserts"));
const withBoth = mainCourseInvoices.filter((inv) => hasCat(inv, "Drinks") && hasCat(inv, "Desserts"));
const withNeither = mainCourseInvoices.filter((inv) => !hasCat(inv, "Drinks") && !hasCat(inv, "Desserts"));

console.log("\n--- Attach rate on Main Course orders ---");
console.log("Main Course orders:", mainCourseInvoices.length);
console.log("  + Drink:", withDrink.length, `(${(100 * withDrink.length / mainCourseInvoices.length).toFixed(1)}%)`);
console.log("  + Dessert:", withDessert.length, `(${(100 * withDessert.length / mainCourseInvoices.length).toFixed(1)}%)`);
console.log("  + Both:", withBoth.length, `(${(100 * withBoth.length / mainCourseInvoices.length).toFixed(1)}%)`);
console.log("  + Neither (dry order):", withNeither.length, `(${(100 * withNeither.length / mainCourseInvoices.length).toFixed(1)}%)`);

function avg(arr, fn) { return arr.length ? arr.reduce((s, x) => s + fn(x), 0) / arr.length : 0; }
console.log("\n--- Avg ticket size by composition ---");
console.log("Main Course only (no drink, no dessert):", avg(withNeither, (i) => i.total).toFixed(2));
console.log("Main Course + Drink only:", avg(mainCourseInvoices.filter(i => hasCat(i,"Drinks") && !hasCat(i,"Desserts")), i => i.total).toFixed(2));
console.log("Main Course + Dessert only:", avg(mainCourseInvoices.filter(i => hasCat(i,"Desserts") && !hasCat(i,"Drinks")), i => i.total).toFixed(2));
console.log("Main Course + Drink + Dessert:", avg(withBoth, i => i.total).toFixed(2));
console.log("All Main Course orders avg:", avg(mainCourseInvoices, i => i.total).toFixed(2));
console.log("All orders avg (any type):", avg(invoices, i => i.total).toFixed(2));

// Per-customer lifetime category coverage
const byCustomer = {};
invoices.forEach((inv) => {
  const id = inv.avyayaId;
  byCustomer[id] = byCustomer[id] || { total: 0, cats: new Set(), visits: 0 };
  byCustomer[id].visits++;
  byCustomer[id].total += inv.total || 0;
  (inv.items || []).forEach((it) => byCustomer[id].cats.add(it.category));
});
const customers = Object.values(byCustomer);
const regulars = customers.filter((c) => c.visits >= 5); // "regulars" = 5+ visits in the dataset window
const regularsNeverDessert = regulars.filter((c) => !c.cats.has("Desserts"));
const regularsNeverDrink = regulars.filter((c) => !c.cats.has("Drinks"));
const regularsNeverBreakfast = regulars.filter((c) => !c.cats.has("Breakfast"));

console.log("\n--- Lifetime category gaps among regulars (5+ visits) ---");
console.log("Total customers:", customers.length);
console.log("Regulars (5+ visits):", regulars.length);
console.log("  Regulars who NEVER ordered Dessert:", regularsNeverDessert.length, `(${(100*regularsNeverDessert.length/regulars.length).toFixed(1)}%)`);
console.log("  Regulars who NEVER ordered a Drink:", regularsNeverDrink.length, `(${(100*regularsNeverDrink.length/regulars.length).toFixed(1)}%)`);
console.log("  Regulars who NEVER ordered Breakfast:", regularsNeverBreakfast.length, `(${(100*regularsNeverBreakfast.length/regulars.length).toFixed(1)}%)`);

// Order-type x category correlation (does delivery skip desserts more?)
console.log("\n--- Dessert/Drink attach rate by order type ---");
["Dine-in", "Takeaway", "Delivery"].forEach((ot) => {
  const sub = invoices.filter((i) => i.orderType === ot);
  const d = sub.filter((i) => hasCat(i, "Desserts")).length;
  const dr = sub.filter((i) => hasCat(i, "Drinks")).length;
  console.log(`  ${ot}: n=${sub.length}, dessert=${(100*d/sub.length).toFixed(1)}%, drink=${(100*dr/sub.length).toFixed(1)}%`);
});

// Breakfast-only vs mixed-daypart customers
const breakfastOnly = customers.filter((c) => c.cats.has("Breakfast") && c.cats.size === 1);
console.log("\n--- Daypart crossover ---");
console.log("Customers who ONLY ever ordered Breakfast items:", breakfastOnly.length, `(${(100*breakfastOnly.length/customers.length).toFixed(1)}%)`);

// Light (single-item) visits vs full orders
const itemCounts = invoices.map((i) => (i.items || []).length);
const singleItem = invoices.filter((i) => (i.items || []).length === 1);
const singleItemDrinkOrDessertOnly = singleItem.filter((i) => hasCat(i, "Drinks") || hasCat(i, "Desserts"));
console.log("\n--- Visit size distribution ---");
console.log("Single-item visits:", singleItem.length, `(${(100*singleItem.length/invoices.length).toFixed(1)}%)`);
console.log("  of which Drink/Dessert-only quick visits:", singleItemDrinkOrDessertOnly.length, `(${(100*singleItemDrinkOrDessertOnly.length/singleItem.length).toFixed(1)}% of single-item visits)`);
console.log("Avg spend, single-item visit:", avg(singleItem, i => i.total).toFixed(2));
console.log("Avg spend, multi-item visit:", avg(invoices.filter(i => (i.items||[]).length > 1), i => i.total).toFixed(2));

// Per-customer: how many of their visits in the last 30/60 days included a drink or dessert (recency-window attach rate)
const now = Date.now();
const THIRTY_D = 30 * 86400000;
const byCustomerRecent = {};
invoices.forEach((inv) => {
  if (now - inv.createdAtMs > THIRTY_D) return;
  const id = inv.avyayaId;
  byCustomerRecent[id] = byCustomerRecent[id] || { visits: 0, withAddon: 0 };
  byCustomerRecent[id].visits++;
  if (hasCat(inv, "Drinks") || hasCat(inv, "Desserts")) byCustomerRecent[id].withAddon++;
});
const recentCustomers = Object.values(byCustomerRecent).filter((c) => c.visits >= 2);
const lowAttachRecent = recentCustomers.filter((c) => c.withAddon / c.visits < 0.34); // matches the 34.3% baseline dry-order rate
console.log("\n--- Recency-window (last 30 days) attach-rate gap ---");
console.log("Customers with 2+ visits in last 30 days:", recentCustomers.length);
console.log("  of which below-baseline add-on rate (<34%):", lowAttachRecent.length, `(${(100*lowAttachRecent.length/recentCustomers.length).toFixed(1)}%)`);
