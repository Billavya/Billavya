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

const ORPHAN_IDS = ["SNB-2H2D-ET5M", "SNB-S7WW-C5FX", "SNB-ZBSP-E935", "SNB-ZQ99-ZA3L"];

function toAvy(oldId) { return "AVY-" + oldId.slice(4); }

async function migrateField(collectionName, fieldName, oldId, newId) {
  const snap = await getDocs(query(collection(db, collectionName), where(fieldName, "==", oldId)));
  if (snap.empty) return 0;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(doc(db, collectionName, d.id), { [fieldName]: newId }));
  await batch.commit();
  return snap.size;
}

async function main() {
  for (const oldId of ORPHAN_IDS) {
    const newId = toAvy(oldId);
    const i1 = await migrateField("invoices", "avyayaId", oldId, newId);
    const i2 = await migrateField("invoices", "snapbillId", oldId, newId);
    const o = await migrateField("offers", "avyayaId", oldId, newId);
    console.log(`✓ ${oldId} -> ${newId} (invoices.avyayaId:${i1} invoices.snapbillId:${i2} offers:${o})`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exitCode = 1;
});
