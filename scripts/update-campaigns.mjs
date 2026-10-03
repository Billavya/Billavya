/**
 * One-off: brings the `campaigns` collection in line with what's actually
 * running now that offers have been pushed for Groceries/Standard and
 * Restaurants/Basic (see push-campaign-offers.mjs) — the Groceries record
 * existed but was stuck at status "saved" (never submitted), and no
 * Restaurants/Basic record existed at all (only Restaurants/Standard did).
 */
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, doc, updateDoc } from "firebase/firestore";

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

await updateDoc(doc(db, "campaigns", "ak0P3SUv6lJHm0XPobXA"), {
  status: "submitted",
  runningSince: Date.now(),
});
console.log("✓ updated Groceries/Standard campaign status -> submitted");

await addDoc(collection(db, "campaigns"), {
  businessName: "Vindu Restaurant",
  category: "Restaurants",
  tier: "basic",
  status: "submitted",
  duration: "1 week",
  merchantEmail: "ksphanindra@gmail.com",
  createdAtMs: Date.now(),
  runningSince: Date.now(),
  filters: { range: "This month", area: "All areas" },
  criteria: [
    { label: "Reach diners in radius", value: "1 km", discountPct: 10, capAmount: 100, active: true },
    { label: "Reach customers who spent more than ___ dining in the last month", value: "₹500", discountPct: 10, capAmount: 100, active: true },
    { label: "Reach customers who dined at my restaurant in the last ___ months", value: "1 month", discountPct: 10, capAmount: 100, active: true },
    { label: "Target customers who never dined at my restaurant", value: "All time", discountPct: 10, capAmount: 100, active: true },
    { label: "Target customers who haven't ordered in the last ___ days", value: "7 days", discountPct: 10, capAmount: 100, active: true },
  ],
});
console.log("✓ created Restaurants/Basic campaign record");
