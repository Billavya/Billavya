/**
 * Independent read-back of pushed offers, through the SAME server-side path
 * the Clover Flex and the app use: the deployed lookupOffers function.
 *
 * Why not read the offers collection directly: firestore.rules scopes offer
 * reads to the owning signed-in customer (`resource.data.avyayaId ==
 * myAvyayaId()`), so an unauthenticated script is correctly denied. Going
 * through lookupOffers verifies what actually matters anyway — that each
 * customer's app will be served these offers as ACTIVE.
 *
 *   node scripts/verify-pushed-offers.mjs ["Merchant Name"]
 *
 * Prints no key material.
 */
import fs from "fs";
import { collection, getDocs, query, where } from "firebase/firestore";
import { firestore, datasetPath } from "./campaign-engine.mjs";

const MERCHANT = process.argv[2] || "Naanna Restaurant";
const LOOKUP_URL = "https://us-central1-letsgetdirty.cloudfunctions.net/lookupOffers";

const ds = JSON.parse(fs.readFileSync(datasetPath(MERCHANT), "utf8"));
const db = firestore();

const msnap = await getDocs(query(collection(db, "merchants"), where("businessName", "==", MERCHANT)));
if (msnap.empty) throw new Error(`No merchants doc with businessName "${MERCHANT}".`);
const apiKey = msnap.docs[0].data().apiKey;
if (!apiKey) throw new Error(`Merchant "${MERCHANT}" has no apiKey — cannot call lookupOffers.`);
console.log(`Using merchant "${MERCHANT}" (merchants/${msnap.docs[0].id}), apiKey present.\n`);

let grandTotal = 0;
const perCode = {};
for (const id of ds.customerIds) {
  const res = await fetch(`${LOOKUP_URL}?avyayaId=${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    console.log(`${id}  HTTP ${res.status} — ${(await res.text()).slice(0, 120)}`);
    continue;
  }
  const json = await res.json();
  const offers = json.offers || [];
  grandTotal += offers.length;
  console.log(`${id}  ${offers.length} active offer(s)`);
  for (const o of offers) {
    console.log(`    ${o.pct}  cap ${o.capAmount}  ${o.exp}  code ${o.code}`);
    perCode[o.code] = (perCode[o.code] || 0) + 1;
  }
}

console.log(`\nTOTAL active offers served across ${ds.customerIds.length} customers: ${grandTotal}`);
console.log("by discount code:");
Object.entries(perCode).sort().forEach(([c, n]) => console.log(`  ${c}  ${n}`));
process.exit(0);
