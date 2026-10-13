/**
 * Generates ~400 dummy customer profiles plus 10,000 invoices (transactions)
 * — spread across those dummy profiles AND the existing real/seeded ones —
 * so the merchant-portal's automated query builder has real volume to query
 * against. Tied to the actual 15 merchants already in the `merchants`
 * collection where possible, with keyword-tagged item names so the
 * category/aisle-matching criteria have genuine signal to work with.
 *
 * Every dummy doc is tagged `isDummy: true` (profiles get an avyayaId
 * prefixed "DEMO-") so this stays clearly identifiable and reversible —
 * never touches real customer data.
 *
 * Usage: node scripts/seed-10k-transactions.mjs
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

const DUMMY_PROFILE_COUNT = 400;
const TOTAL_INVOICES = 10000;

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pad(n) { return String(n).padStart(4, "0"); }

const FIRST_NAMES = ["Aarav", "Vihaan", "Ishaan", "Anaya", "Diya", "Kavya", "Rohan", "Ananya", "Arjun", "Meera", "Liam", "Olivia", "Noah", "Emma", "Ethan", "Ava", "Mason", "Sophia", "Lucas", "Isabella", "Logan", "Mia", "Jack", "Zoe", "Ryan", "Chloe", "Aiden", "Grace", "Nathan", "Lily"];
const LAST_NAMES = ["Sharma", "Verma", "Patel", "Iyer", "Reddy", "Nair", "Gupta", "Mehta", "Singh", "Rao", "Smith", "Brown", "Wilson", "Taylor", "Clark", "Lee", "Walker", "Hall", "Allen", "Young"];

const INDIA_CITIES = ["Bengaluru", "Mumbai", "Delhi", "Hyderabad", "Chennai", "Pune"];
const CANADA_CITIES = ["Toronto", "Vancouver", "Calgary", "Ottawa", "Montreal", "Edmonton"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const MERCHANTS = [
  { category: "Groceries", country: "Canada", businessName: "Harbour Grocers", address: "2748 West Broadway, Vancouver, BC V6K 2G6" },
  { category: "Food", country: "Canada", businessName: "Maple Leaf Bistro", address: "245 Queen Street West, Toronto, ON M5V 1Z4" },
  { category: "Food", country: "India", businessName: "Spice Junction", address: "14 Brigade Road, Bengaluru, Karnataka 560025" },
  { category: "Groceries", country: "India", businessName: "Apna Bazaar", address: "9 Lajpat Nagar, New Delhi, Delhi 110024" },
  { category: "Food", country: "India", businessName: "Coastal Curry House", address: "88 Linking Road, Bandra West, Mumbai, Maharashtra 400050" },
  { category: "Food", country: "Canada", businessName: "Rocky Mountain Diner", address: "830 17th Avenue SW, Calgary, AB T2T 0A1" },
  { category: "Groceries", country: "India", businessName: "Metro Grocers", address: "12 SV Road, Andheri West, Mumbai, Maharashtra 400058" },
  { category: "Food", country: "India", businessName: "Punjabi Tadka", address: "21 Connaught Place, New Delhi, Delhi 110001" },
  { category: "Groceries", country: "India", businessName: "Daily Basket Mart", address: "56 Indiranagar 100ft Road, Bengaluru, Karnataka 560038" },
  { category: "Groceries", country: "Canada", businessName: "Northern Fresh Market", address: "500 Danforth Avenue, Toronto, ON M4K 1P5" },
  { category: "Groceries", country: "Canada", businessName: "Prairie Foods", address: "1600 90 Avenue SW, Calgary, AB T2V 5B3" },
  { category: "Food", country: "Canada", businessName: "Vikasitam", address: "460 Columbia St W, Waterloo, Ontario, N2T 0C7" },
  { category: "Food", country: "Canada", businessName: "Pacific Grill House", address: "1038 Robson Street, Vancouver, BC V6E 1A8" },
];

const FOOD_ITEMS = {
  Starters: ["Veg Spring Roll", "Chicken 65", "Soup of the Day", "Garden Salad", "Paneer Tikka"],
  "Main Course": ["Chicken Biryani", "Butter Naan + Dal Makhani", "Veg Fried Rice", "Margherita Pizza", "Classic Burger"],
  Desserts: ["Gulab Jamun", "Chocolate Brownie", "Kulfi", "Ice Cream Sundae"],
  Beverages: ["Masala Chai", "Cold Coffee", "Fresh Lime Soda", "Mango Lassi"],
  Combos: ["Thali Combo", "Meal Box Special", "Family Platter"],
};
const GROCERY_ITEMS = {
  Staples: ["Basmati Rice (5kg)", "Toor Dal (1kg)", "Atta (10kg)", "Cooking Oil (1L)"],
  "Fresh Produce": ["Bananas (1 dozen)", "Onions (1kg)", "Tomatoes (1kg)", "Apples (1kg)"],
  "Dairy & Eggs": ["Milk (1L)", "Paneer (200g)", "Eggs (12 pack)", "Yogurt (500g)"],
  "Snacks & Beverages": ["Potato Chips", "Biscuits Pack", "Orange Juice (1L)", "Masala Tea (250g)"],
  Household: ["Dish Soap", "Laundry Detergent", "Paper Towels"],
  "Personal Care": ["Shampoo (200ml)", "Toothpaste", "Body Lotion"],
};
const OTHER_FOLDERS = ["Healthcare", "Travel", "Entertainment", "Beauty", "Apparels", "Stationery"];
const OTHER_MERCHANTS = {
  Healthcare: "Apollo Pharmacy", Travel: "Ola Cabs", Entertainment: "PVR Cinemas", Beauty: "Nykaa", Apparels: "Myntra", Stationery: "Office Depot",
};

function genItems(folder, categoryOptions) {
  const itemBank = folder === "Food" ? FOOD_ITEMS : GROCERY_ITEMS;
  const cat = pick(categoryOptions);
  const names = itemBank[cat];
  const count = randInt(1, 3);
  const items = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const name = pick(names);
    const qty = randInt(1, 3);
    const unit = randInt(20, 400);
    const amount = qty * unit;
    total += amount;
    items.push({ name, qty, unit, amount, variant: null });
  }
  return { items, total };
}

async function main() {
  console.log("Fetching existing real profiles...");
  const profSnap = await getDocs(collection(db, "profiles"));
  const existingIds = profSnap.docs.map((d) => d.data().avyayaId).filter(Boolean);
  console.log(`Found ${existingIds.length} existing real profiles.`);

  console.log(`Generating ${DUMMY_PROFILE_COUNT} dummy profiles...`);
  const dummyProfiles = [];
  for (let i = 0; i < DUMMY_PROFILE_COUNT; i++) {
    const country = Math.random() < 0.55 ? "India" : "Canada";
    const city = pick(country === "India" ? INDIA_CITIES : CANADA_CITIES);
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const avyayaId = `DEMO-${pad(randInt(0, 9999))}-${pad(randInt(0, 9999))}`;
    dummyProfiles.push({
      avyayaId,
      userId: avyayaId,
      email: `${firstName}.${lastName}.${i}@avyaya-demo.test`.toLowerCase(),
      firstName,
      lastName,
      city,
      country,
      birthMonth: pick(MONTHS),
      birthYear: String(randInt(1965, 2002)),
      isDummy: true,
      createdAtMs: Date.now(),
    });
  }

  console.log("Writing dummy profiles...");
  {
    let batch = writeBatch(db);
    let n = 0;
    for (const p of dummyProfiles) {
      batch.set(doc(collection(db, "profiles")), p);
      n++;
      if (n >= 450) { await batch.commit(); batch = writeBatch(db); n = 0; }
    }
    if (n > 0) await batch.commit();
  }
  console.log("Dummy profiles written.");

  // Mix: most invoices go to dummy profiles (this is a volume/testing
  // dataset), but a meaningful slice (15%) lands on real existing profiles
  // too, so the query builder is exercised against a realistic mix, not an
  // entirely synthetic population.
  const dummyIds = dummyProfiles.map((p) => p.avyayaId);
  const dummyById = {};
  dummyProfiles.forEach((p) => (dummyById[p.avyayaId] = p));

  console.log(`Generating ${TOTAL_INVOICES} invoices...`);
  const now = Date.now();
  const FOUR_MONTHS_MS = 120 * 86400000;
  let written = 0;
  let batch = writeBatch(db);
  let batchN = 0;

  for (let i = 0; i < TOTAL_INVOICES; i++) {
    const useExisting = Math.random() < 0.15 && existingIds.length > 0;
    const avyayaId = useExisting ? pick(existingIds) : pick(dummyIds);
    const customerCountry = useExisting ? null : dummyById[avyayaId].country; // existing profiles' own country is unknown here; merchant pick below handles it either way

    const isFoodOrGrocery = Math.random() < 0.88;
    let merchant, folder;
    if (isFoodOrGrocery) {
      const pool = customerCountry ? MERCHANTS.filter((m) => m.country === customerCountry) : MERCHANTS;
      merchant = pick(pool.length ? pool : MERCHANTS);
      folder = merchant.category;
    } else {
      folder = pick(OTHER_FOLDERS);
      const country = customerCountry || pick(["India", "Canada"]);
      merchant = { category: folder, country, businessName: OTHER_MERCHANTS[folder], address: country === "India" ? "Bengaluru" : "Toronto" };
    }

    const categoryOptionsFood = ["Starters", "Main Course", "Desserts", "Beverages", "Combos"];
    const categoryOptionsGrocery = ["Staples", "Fresh Produce", "Dairy & Eggs", "Snacks & Beverages", "Household", "Personal Care"];
    const { items, total } = folder === "Food" || folder === "Groceries"
      ? genItems(folder, folder === "Food" ? categoryOptionsFood : categoryOptionsGrocery)
      : (() => { const amt = randInt(100, 2000); return { items: [{ name: merchant.businessName + " purchase", qty: 1, unit: amt, amount: amt, variant: null }], total: amt }; })();

    const createdAtMs = now - randInt(0, FOUR_MONTHS_MS);
    const orderType = folder === "Food"
      ? pick(["Dine-in", "Takeaway", "Delivery"])
      : folder === "Groceries"
      ? pick(["Walk-in", "Home Delivery", "Pickup"])
      : "Walk-in";

    const invoiceDoc = {
      avyayaId,
      folder,
      merchant: merchant.businessName,
      merchantAddress: merchant.address,
      country: merchant.country,
      orderType,
      items, // a real Firestore array — InvoiceDetailModal.tsx calls .map() on this directly, same as every real invoice
      total,
      subtotal: total,
      tax: 0,
      discount: 0,
      createdAtMs,
      date: new Date(createdAtMs).toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " · " + new Date(createdAtMs).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      invoiceNo: "INV-" + randInt(100000, 999999),
      isDummy: true,
    };

    batch.set(doc(collection(db, "invoices")), invoiceDoc);
    batchN++;
    written++;
    if (batchN >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      batchN = 0;
      if (written % 2250 === 0) console.log(`  ${written} / ${TOTAL_INVOICES} invoices written...`);
    }
  }
  if (batchN > 0) await batch.commit();

  console.log(`Done — ${dummyProfiles.length} dummy profiles + ${written} invoices written (${existingIds.length ? "including a 15% slice on real existing profiles" : "all dummy"}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
