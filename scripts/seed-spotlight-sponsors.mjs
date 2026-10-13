/**
 * Seeds demo merchant sponsors for the Peak-Hours/Festival Spotlight feature
 * straight into the live `spotlightSponsors` Firestore collection — see
 * src/services/spotlightSponsors.ts for the shape, and
 * src/data/spotlightConfig.ts for the Hindu festival calendar these festival
 * rows are keyed against.
 *
 * ONE sponsor per country per window/day — not per city. Switching country
 * alone is enough for a customer to see that country's current merchant
 * campaign; city plays no part in the lookup (see src/hooks/useActiveSpotlights.ts).
 *
 * Uses deterministic doc IDs (setDoc, not addDoc) so re-running this script
 * updates the same demo rows instead of creating duplicates.
 *
 * Usage: node scripts/seed-spotlight-sponsors.mjs
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

const now = Date.now();

const daypartSponsors = [
  {
    id: "India_Food_lunch",
    kind: "daypart",
    country: "India",
    category: "Food",
    window: "lunch",
    merchantName: "Urban Tiffin Co.",
    offerLine: "15% off lunch thali, 11 AM–1 PM — dine in or takeout.",
    active: true,
    createdAtMs: now,
  },
  {
    id: "India_Food_dinner",
    kind: "daypart",
    country: "India",
    category: "Food",
    window: "dinner",
    merchantName: "Spice Route Kitchen",
    offerLine: "20% off tonight, 6–9 PM — dine in or takeout.",
    active: true,
    createdAtMs: now,
  },
  {
    id: "Canada_Food_lunch",
    kind: "daypart",
    country: "Canada",
    category: "Food",
    window: "lunch",
    merchantName: "Maple & Rye Deli",
    offerLine: "15% off lunch combos, 11 AM–1 PM.",
    active: true,
    createdAtMs: now,
  },
  {
    id: "Canada_Food_dinner",
    kind: "daypart",
    country: "Canada",
    category: "Food",
    window: "dinner",
    merchantName: "Harbourfront Grill",
    offerLine: "20% off dinner mains, 6–9 PM.",
    active: true,
    createdAtMs: now,
  },
];

// Navratri Begins is 2026-10-11 — the 3-day window is Oct 9, 10, 11, one
// different merchant per day (src/data/spotlightConfig.ts's FESTIVAL_WINDOW_DAYS).
// Hindu-festival sponsors are India-specific.
const festivalSponsors = [
  {
    id: "India_Religion_festival_2026-10-09",
    kind: "festival",
    country: "India",
    category: "Religion",
    date: "2026-10-09",
    festivalName: "Navratri Begins",
    merchantName: "Ganpati Sweets & Mithai",
    offerLine: "20% off festive mithai boxes.",
    active: true,
    createdAtMs: now,
  },
  {
    id: "India_Religion_festival_2026-10-10",
    kind: "festival",
    country: "India",
    category: "Religion",
    date: "2026-10-10",
    festivalName: "Navratri Begins",
    merchantName: "Silk & Saree House",
    offerLine: "Flat ₹500 off festive sarees.",
    active: true,
    createdAtMs: now,
  },
  {
    id: "India_Religion_festival_2026-10-11",
    kind: "festival",
    country: "India",
    category: "Religion",
    date: "2026-10-11",
    festivalName: "Navratri Begins",
    merchantName: "Diya Decor Studio",
    offerLine: "Buy 2 get 1 free on diyas & rangoli kits.",
    active: true,
    createdAtMs: now,
  },
];

// Old per-city doc IDs from before this collection was simplified to
// country-only — deleted so they don't linger as orphaned, never-matched rows.
const OBSOLETE_CITY_IDS = [
  "India_Bengaluru_Food_lunch", "India_Bengaluru_Food_dinner",
  "India_Mumbai_Food_lunch", "India_Mumbai_Food_dinner",
  "India_Delhi_Food_lunch", "India_Delhi_Food_dinner",
  "India_Hyderabad_Food_lunch", "India_Hyderabad_Food_dinner",
  "India_Chennai_Food_lunch", "India_Chennai_Food_dinner",
  "India_Pune_Food_lunch", "India_Pune_Food_dinner",
  "Canada_Toronto_Food_lunch", "Canada_Toronto_Food_dinner",
  "Canada_Vancouver_Food_lunch", "Canada_Vancouver_Food_dinner",
  "Canada_Calgary_Food_lunch", "Canada_Calgary_Food_dinner",
  "Canada_Ottawa_Food_lunch", "Canada_Ottawa_Food_dinner",
  "Canada_Montreal_Food_lunch", "Canada_Montreal_Food_dinner",
  "Canada_Edmonton_Food_lunch", "Canada_Edmonton_Food_dinner",
  "India_Bengaluru_Religion_festival_2026-10-09", "India_Bengaluru_Religion_festival_2026-10-10", "India_Bengaluru_Religion_festival_2026-10-11",
  "India_Mumbai_Religion_festival_2026-10-09", "India_Mumbai_Religion_festival_2026-10-10", "India_Mumbai_Religion_festival_2026-10-11",
  "India_Delhi_Religion_festival_2026-10-09", "India_Delhi_Religion_festival_2026-10-10", "India_Delhi_Religion_festival_2026-10-11",
  "India_Hyderabad_Religion_festival_2026-10-09", "India_Hyderabad_Religion_festival_2026-10-10", "India_Hyderabad_Religion_festival_2026-10-11",
  "India_Chennai_Religion_festival_2026-10-09", "India_Chennai_Religion_festival_2026-10-10", "India_Chennai_Religion_festival_2026-10-11",
  "India_Pune_Religion_festival_2026-10-09", "India_Pune_Religion_festival_2026-10-10", "India_Pune_Religion_festival_2026-10-11",
];

async function main() {
  const { deleteDoc } = await import("firebase/firestore");
  for (const id of OBSOLETE_CITY_IDS) {
    await deleteDoc(doc(db, "spotlightSponsors", id));
  }
  console.log(`Removed ${OBSOLETE_CITY_IDS.length} obsolete per-city rows.`);

  const rows = [...daypartSponsors, ...festivalSponsors];
  for (const row of rows) {
    const { id, ...data } = row;
    await setDoc(doc(db, "spotlightSponsors", id), data);
    console.log("seeded", id);
  }
  console.log(`Done — ${rows.length} country-level sponsor rows written.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
