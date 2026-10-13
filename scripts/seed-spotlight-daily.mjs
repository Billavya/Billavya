/**
 * Daily Spotlight sponsor refresh — meant to run once per day (see the
 * scheduled job set up alongside this script). Writes the SAME country-level
 * doc IDs the original one-time seed-spotlight-sponsors.mjs used
 * (`{Country}_Food_{window}`, `India_Religion_festival_{date}`), so
 * src/services/spotlightSponsors.ts and useActiveSpotlights.ts need no
 * changes — only the CONTENT behind those docs now actually changes day to
 * day, which the original static seed never did.
 *
 * Daypart rotation: deterministic by day-of-year, cycling through a pool of
 * REAL merchants (pulled from the actual `merchants` collection) per
 * country/window — simulates the "one restaurant per window, per day"
 * exclusive-reservation model described in
 * BillAvya-Campaign-Parameters-Restaurants.docx, until a real paid-
 * reservation system exists to replace this rotation.
 *
 * Festival tracking: ports the exact activeFestivalWindow() logic from
 * src/data/spotlightConfig.ts (can't import the .ts file directly from a
 * plain Node script) against the same HINDU_FESTIVALS_2026 calendar — only
 * writes a festival sponsor doc for TODAY when today genuinely falls in a
 * real festival's 3-day window; writes nothing otherwise, rather than
 * leaving stale data in place.
 *
 * Usage: node scripts/seed-spotlight-daily.mjs
 */
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

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

function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
}
function localDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ---- Daypart rotation pools — real merchants from the `merchants` collection ----
const DAYPART_POOLS = {
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

// ---- Festival calendar — exact copy of src/data/spotlightConfig.ts's HINDU_FESTIVALS_2026 ----
const HINDU_FESTIVALS_2026 = [
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
const FESTIVAL_WINDOW_DAYS = 3;

function activeFestivalWindow(todayKey, festivals = HINDU_FESTIVALS_2026) {
  const [ty, tm, td] = todayKey.split("-").map(Number);
  const today = Date.UTC(ty, tm - 1, td);
  for (const festival of festivals) {
    const [y, m, d] = festival.date.split("-").map(Number);
    const festivalDate = Date.UTC(y, m - 1, d);
    const daysUntil = Math.round((festivalDate - today) / 86400000);
    if (daysUntil >= 0 && daysUntil < FESTIVAL_WINDOW_DAYS) {
      return { festival, dayIndex: FESTIVAL_WINDOW_DAYS - 1 - daysUntil, daysUntil };
    }
  }
  return null;
}

// Illustrative festival-goods sponsor pool — no real "festival gifting"
// merchant category exists in the `merchants` collection yet (it's Food and
// Groceries only), so this stays representative rather than tied to a real
// merchant record, same as the original one-time seed.
const FESTIVAL_SPONSOR_POOL = [
  { merchantName: "Ganpati Sweets & Mithai", offerLine: "20% off festive mithai boxes." },
  { merchantName: "Silk & Saree House", offerLine: "Flat ₹500 off festive sarees." },
  { merchantName: "Diya Decor Studio", offerLine: "Buy 2 get 1 free on diyas & rangoli kits." },
];

async function main() {
  const now = new Date();
  const doy = dayOfYear(now);
  const todayKey = localDateKey(now);

  console.log(`Running Spotlight daily refresh for ${todayKey} (day ${doy} of year)...`);

  // ---- Daypart: rotate through the real-merchant pool for each country/window ----
  for (const country of Object.keys(DAYPART_POOLS)) {
    for (const window of Object.keys(DAYPART_POOLS[country])) {
      const pool = DAYPART_POOLS[country][window];
      const pick = pool[doy % pool.length];
      const id = `${country}_Food_${window}`;
      await setDoc(doc(db, "spotlightSponsors", id), {
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

  // ---- Festival: only write a sponsor doc for TODAY if a real festival window is active ----
  const active = activeFestivalWindow(todayKey);
  if (active) {
    const pick = FESTIVAL_SPONSOR_POOL[active.dayIndex % FESTIVAL_SPONSOR_POOL.length];
    const id = `India_Religion_festival_${todayKey}`;
    await setDoc(doc(db, "spotlightSponsors", id), {
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
    console.log(`  Festival window active: ${active.festival.name} (day ${active.dayIndex + 1}/${FESTIVAL_WINDOW_DAYS}) -> ${id} -> ${pick.merchantName}`);
  } else {
    console.log("  No festival window active today — nothing to seed for Religion.");
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
