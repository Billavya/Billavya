/**
 * One-off: pushes `offers` Firestore docs for the two campaigns the user
 * asked to "run" — Groceries/Standard (FreshMart Grocers) and
 * Restaurants/Basic (Vindu Restaurant) — to every unique Avyaya ID, so the
 * app's Food/Groceries folder "Offers" columns show something real.
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

const IDS = [
  "SNB-BBZT-NNE6","SNB-G85T-DG2J","SNB-BF2H-8JVY","SNB-ZBSP-E93S","SNB-78VZ-P4X6",
  "AVY-HLFL-BQXA","AVY-2ZK4-HNRP","SNB-EHFD-C527","SNB-PHBR-ZREN","SNB-QH2D-ET5M",
  "SNB-MLBQ-DTQU","SNB-7ET2-FD8J","SNB-MHN4-PRNG","SNB-K3WG-2BMT","SNB-5TZD-KSX9",
  "SNB-GUB2-CXPN","AVY-9R92-K6UV","SNB-MZDQ-BTXJ","SNB-82YM-FY8W","AVY-EN5L-K64H",
  "SNB-89P9-LKTK","AVY-DLYS-VMLX",
];

const now = Date.now();
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const expDate = new Date(now + THIRTY_DAYS);
const expLabel = expDate.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });

const CAMPAIGNS = [
  {
    folder: "Groceries",
    merchant: "FreshMart Grocers",
    pct: "10% off",
    desc: "10% off your grocery bill — capped at ₹100",
    criterion: "Spend over ₹500 on groceries in the last month",
    campaignTier: "standard",
    capAmount: 100,
  },
  {
    folder: "Food",
    merchant: "Vindu Restaurant",
    pct: "10% off",
    desc: "10% off your dining bill — capped at ₹100",
    criterion: "Reach diners within 1 km",
    campaignTier: "basic",
    capAmount: 100,
  },
];

async function main() {
  let written = 0;
  const failures = [];
  for (const avyayaId of IDS) {
    for (const c of CAMPAIGNS) {
      const record = {
        avyayaId,
        folder: c.folder,
        pct: c.pct,
        merchant: c.merchant,
        desc: c.desc,
        exp: expLabel,
        campaignTier: c.campaignTier,
        criterion: c.criterion,
        capAmount: c.capAmount,
        createdAtMs: now,
        activated: false,
        activatedAtMs: null,
        redeemedAtMs: null,
        expiresAtMs: now + THIRTY_DAYS,
      };
      try {
        const ref = await addDoc(collection(db, "offers"), record);
        written += 1;
        console.log(`✓ ${avyayaId} · ${c.folder} · ${c.merchant} · ${ref.id}`);
      } catch (err) {
        failures.push({ avyayaId, folder: c.folder, error: String(err) });
        console.error(`✗ FAILED ${avyayaId} · ${c.folder}:`, err);
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
