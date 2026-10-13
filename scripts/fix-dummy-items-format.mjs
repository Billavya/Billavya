/**
 * One-time fix: scripts/seed-10k-transactions.mjs wrote `items` as a
 * JSON-STRING on every dummy invoice, but the real app (InvoiceDetailModal.tsx)
 * calls `.map()` directly on `invoice.items`, expecting a true Firestore
 * array — exactly how every real, non-dummy invoice already stores it.
 * Any dummy invoice opened in the real app would crash on this mismatch,
 * including the ~15% that landed on real existing accounts.
 *
 * This finds every `isDummy: true` invoice, parses its stringified `items`
 * back into a real array, and rewrites just that field in place.
 *
 * Usage: node scripts/fix-dummy-items-format.mjs
 */
import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, writeBatch, doc } from "firebase/firestore";

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

async function main() {
  const snap = await getDocs(query(collection(db, "invoices"), where("isDummy", "==", true)));
  console.log(`Found ${snap.size} dummy invoices to check.`);

  let fixed = 0, alreadyOk = 0, failed = 0;
  let batch = writeBatch(db);
  let batchN = 0;

  for (const d of snap.docs) {
    const data = d.data();
    if (Array.isArray(data.items)) { alreadyOk++; continue; }
    if (typeof data.items !== "string") { failed++; continue; }
    try {
      const parsed = JSON.parse(data.items);
      if (!Array.isArray(parsed)) { failed++; continue; }
      batch.update(doc(db, "invoices", d.id), { items: parsed });
      batchN++;
      fixed++;
      if (batchN >= 450) { await batch.commit(); batch = writeBatch(db); batchN = 0; }
    } catch (e) {
      failed++;
    }
  }
  if (batchN > 0) await batch.commit();

  console.log(`Done — fixed ${fixed}, already correct ${alreadyOk}, failed to parse ${failed}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
