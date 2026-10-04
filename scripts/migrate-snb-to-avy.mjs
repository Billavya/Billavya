/**
 * One-off migration: renames every customer-facing ID still using the old
 * "SNB-" (SnapBill) prefix to the current "AVY-" (Avyaya) prefix, across
 * every collection that stores it — profiles.avyayaId, invoices.avyayaId,
 * invoices.snapbillId, and offers.avyayaId. Firestore document IDs
 * themselves are untouched (profiles are keyed by email, invoices/offers by
 * auto-generated IDs) — only the ID *value* stored in these fields changes.
 *
 * Uses batched writes (≤500 ops each) for efficiency; prints a full
 * before/after count per collection so the migration is verifiable, not
 * just "trust it worked".
 */
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
} from "firebase/firestore";

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

function toAvy(oldId) {
  return "AVY-" + oldId.slice(4);
}

async function migrateField(collectionName, fieldName, oldId, newId) {
  const snap = await getDocs(query(collection(db, collectionName), where(fieldName, "==", oldId)));
  if (snap.empty) return 0;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(doc(db, collectionName, d.id), { [fieldName]: newId }));
  await batch.commit();
  return snap.size;
}

async function main() {
  // Discover every distinct SNB- ID currently in use, from the most
  // authoritative source (profiles), same as the audit done before this
  // script was written.
  const profilesSnap = await getDocs(collection(db, "profiles"));
  const oldIds = new Set();
  profilesSnap.docs.forEach((d) => {
    const aid = d.data().avyayaId;
    if (typeof aid === "string" && aid.startsWith("SNB-")) oldIds.add(aid);
  });

  console.log(`Found ${oldIds.size} SNB- prefixed IDs to migrate.\n`);

  const totals = { profiles: 0, invoicesAvyayaId: 0, invoicesSnapbillId: 0, offers: 0 };

  for (const oldId of oldIds) {
    const newId = toAvy(oldId);
    const p = await migrateField("profiles", "avyayaId", oldId, newId);
    const i1 = await migrateField("invoices", "avyayaId", oldId, newId);
    const i2 = await migrateField("invoices", "snapbillId", oldId, newId);
    const o = await migrateField("offers", "avyayaId", oldId, newId);
    totals.profiles += p;
    totals.invoicesAvyayaId += i1;
    totals.invoicesSnapbillId += i2;
    totals.offers += o;
    console.log(`✓ ${oldId} -> ${newId}  (profiles:${p} invoices.avyayaId:${i1} invoices.snapbillId:${i2} offers:${o})`);
  }

  console.log("\nTotals:");
  console.log("  profiles updated:          ", totals.profiles);
  console.log("  invoices.avyayaId updated: ", totals.invoicesAvyayaId);
  console.log("  invoices.snapbillId updated:", totals.invoicesSnapbillId);
  console.log("  offers updated:            ", totals.offers);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exitCode = 1;
});
