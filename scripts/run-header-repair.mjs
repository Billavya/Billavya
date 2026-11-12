/**
 * Calls the deployed repairMerchantHeaders function for a merchant.
 * Dry run unless --apply is passed. Prints no key material.
 *
 *   node scripts/run-header-repair.mjs ["Merchant Name"] [--apply]
 */
import { collection, getDocs, query, where } from "firebase/firestore";
import { firestore } from "./campaign-engine.mjs";

const APPLY = process.argv.includes("--apply");
const MERCHANT = process.argv.slice(2).find((a) => !a.startsWith("--")) || "Naanna Restaurant";
const URL = "https://us-central1-letsgetdirty.cloudfunctions.net/repairMerchantHeaders";

const db = firestore();
const msnap = await getDocs(query(collection(db, "merchants"), where("businessName", "==", MERCHANT)));
if (msnap.empty) throw new Error(`No merchants doc for "${MERCHANT}".`);
const apiKey = msnap.docs[0].data().apiKey;
if (!apiKey) throw new Error(`"${MERCHANT}" has no apiKey.`);

const res = await fetch(`${URL}?apply=${APPLY}`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}` } });
const raw = await res.text();
let json;
try {
  json = JSON.parse(raw);
} catch (_) {
  // A Cloud Run / infrastructure error returns an HTML page, not JSON —
  // surface it instead of dying on a parse error that hides the real status.
  console.error(`HTTP ${res.status} (non-JSON response):\n${raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400)}`);
  process.exit(1);
}
if (!res.ok || !json.success) {
  console.error(`HTTP ${res.status}:`, JSON.stringify(json));
  process.exit(1);
}

console.log(`${json.merchant}: scanned ${json.scanned} invoices, ${json.needingRepair} need repair, applied=${json.applied}\n`);
for (const r of json.repairs) {
  console.log(`  ${r.invoiceNo || r.id}`);
  console.log(`    merchantAddress: ${JSON.stringify(String(r.before.merchantAddress).slice(0, 80))}`);
  console.log(`                  -> ${JSON.stringify(r.patch.merchantAddress ?? "(unchanged)")}`);
  console.log(`    gstin          : ${JSON.stringify(String(r.before.gstin).slice(0, 80))}`);
  console.log(`                  -> ${JSON.stringify(r.patch.gstin ?? "(unchanged)")}\n`);
}
if (!APPLY) console.log("DRY RUN — nothing written. Re-run with --apply.");
process.exit(0);
