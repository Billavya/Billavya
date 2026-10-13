/**
 * Mints (or rotates) an API key for one merchant, so their POS/integration
 * can authenticate against the receiveInvoice Cloud Function
 * (functions/index.js) with `Authorization: Bearer <key>`.
 *
 * Usage:
 *   node scripts/generate-pos-api-key.mjs spicejunction_blr
 *     -> looks up the merchant by userId (or merchantEmail), generates a
 *        fresh key, writes it to merchants/{id}.apiKey, and prints it once.
 *        The key is never re-displayable after this — rotate (re-run) if lost.
 */
import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import crypto from "node:crypto";

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

const identifier = process.argv[2];
if (!identifier) {
  console.error("Usage: node scripts/generate-pos-api-key.mjs <merchant userId or email>");
  process.exit(1);
}

function generateKey() {
  return "bavy_live_" + crypto.randomBytes(24).toString("hex");
}

async function main() {
  const snap = await getDocs(
    query(collection(db, "merchants"), where("userId", "==", identifier))
  );
  let targetDoc = snap.docs[0];
  if (!targetDoc) {
    const byEmail = await getDocs(query(collection(db, "merchants"), where("email", "==", identifier)));
    targetDoc = byEmail.docs[0];
  }
  if (!targetDoc) {
    console.error(`No merchant found with userId or email "${identifier}".`);
    process.exit(1);
  }

  const key = generateKey();
  await updateDoc(doc(db, "merchants", targetDoc.id), { apiKey: key });

  const m = targetDoc.data();
  console.log(`API key generated for ${m.businessName} (${m.category}, ${m.country || "India"}):`);
  console.log("");
  console.log(`  ${key}`);
  console.log("");
  console.log("This is shown once — store it now. Example call:");
  console.log(`
curl -X POST https://<region>-<project>.cloudfunctions.net/receiveInvoice \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "avyayaId": "AVY-XXXX-XXXX",
    "items": [{ "name": "Veg Spring Roll", "qty": 2, "unit": 120 }],
    "orderType": "Dine-in"
  }'`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
