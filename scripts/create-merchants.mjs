/**
 * One-off: creates the 12 merchant accounts (3 Food + 3 Groceries for
 * India, same split for Canada) defined by build_merchants.py, writing
 * directly to the same `merchants` collection the BillAvya merchant portal
 * (merchant-portal/index.html) and the campaign-builder pages read from.
 */
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { readFileSync } from "fs";

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

const merchants = JSON.parse(
  readFileSync("/private/tmp/claude-501/-Users-ksphanindra/d23b7352-0b3f-4d0a-8fa4-4752e01ccdb3/scratchpad/merchants.json", "utf-8")
);

async function main() {
  let written = 0;
  for (const m of merchants) {
    const record = {
      firstName: m.firstName,
      lastName: m.lastName,
      businessName: m.businessName,
      address: m.address,
      gstin: m.gst,
      country: m.country,
      anniversary: m.anniversary,
      category: m.category,
      email: m.email,
      userId: m.userId,
      password: m.password,
      createdAtMs: Date.now(),
    };
    const ref = await addDoc(collection(db, "merchants"), record);
    written += 1;
    console.log(`✓ ${m.country} · ${m.category} · ${m.businessName} · ${ref.id}`);
  }
  console.log(`\nDone. Wrote ${written} merchants.`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exitCode = 1;
});
