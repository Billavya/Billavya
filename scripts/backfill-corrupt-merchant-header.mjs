/**
 * Repairs invoices whose merchantAddress / gstin were stored as the raw,
 * double-escaped JSON blob Clover returns, e.g.
 *
 *   merchantAddress: "{\\"storeHeadline\\":\\"Foothill BLVD, Sunnyvale, CA, …
 *   gstin:           "HST # 123456782 RT0001 (TEST)\\\\\"}\""
 *
 * Cause and forward fix are in functions/index.js (extractCloverReceiptHeaderBlob
 * now walks string leaves and parses double-encoded values). This repairs the
 * documents written before that fix — invoices snapshot the merchant header at
 * creation, so they do not self-heal.
 *
 *   node scripts/backfill-corrupt-merchant-header.mjs            # dry run
 *   node scripts/backfill-corrupt-merchant-header.mjs --apply    # write
 */
import { collection, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { firestore } from "./campaign-engine.mjs";

const APPLY = process.argv.includes("--apply");
const MERCHANT = process.argv.find((a) => !a.startsWith("--") && a !== process.argv[0] && a !== process.argv[1]) || "Naanna Restaurant";

const TAX_WORD_RE = /\b(?:GST|HST|VAT|PST|QST)\b/i;
/** Looks like JSON/escaping leaked into a field meant to hold plain text. */
const LOOKS_CORRUPT = (s) => typeof s === "string" && /storeHeadline|\\"|^\s*["{]|\}"?\s*$/.test(s);

/** Pulls the human text back out of whatever escaping it got wrapped in. */
function unwrap(raw) {
  let s = String(raw || "");
  for (let i = 0; i < 4; i++) {
    const before = s;
    s = s.replace(/\\+"/g, '"').replace(/\\+n/g, " ");
    try {
      if (/^\s*["{[]/.test(s)) {
        const parsed = JSON.parse(s);
        if (typeof parsed === "string") { s = parsed; continue; }
        if (parsed && typeof parsed === "object") {
          const leaf = Object.values(parsed).find((v) => typeof v === "string");
          if (leaf) { s = leaf; continue; }
        }
      }
    } catch (_) { /* not valid JSON at this depth — keep unescaping */ }
    if (s === before) break;
  }
  s = s.replace(/^[\s"{[]+/, "").replace(/[\s"}\]]+$/, "");
  // The stored value is often a TRUNCATED fragment of the blob (it was cut at
  // the field boundary), so it never parses as JSON and the object key is left
  // stranded at the front: 'storeHeadline":"Foothill BLVD, …'. Strip a leaked
  // key only in its unmistakable JSON form — an identifier immediately
  // followed by a quote and a colon, which no real street address contains.
  s = s.replace(/^[A-Za-z_][A-Za-z0-9_]*"\s*:\s*"?/, "");
  return s.replace(/^[\s"{[]+/, "").replace(/\s+/g, " ").trim();
}

function split(text) {
  const m = text.match(TAX_WORD_RE);
  if (!m) return { address: text || null, taxId: null };
  const taxId = text.slice(m.index).trim();
  const address = text
    .slice(0, m.index)
    .replace(/[\s.,;|-]*(?:tax\s*id|taxid|business\s*(?:no|number)|reg(?:istration)?\s*(?:no|number)?)\s*[:#-]*\s*$/i, "")
    .replace(/[\s.,;|-]+$/, "")
    .trim();
  return { address: address || null, taxId };
}

const db = firestore();
const snap = await getDocs(query(collection(db, "invoices"), where("merchant", "==", MERCHANT)));
const docs = snap.docs.map((d) => ({ _id: d.id, ...d.data() }));
console.log(`"${MERCHANT}": ${docs.length} invoices\n`);

const fixes = [];
for (const d of docs) {
  const addrBad = LOOKS_CORRUPT(d.merchantAddress);
  const taxBad = LOOKS_CORRUPT(d.gstin);
  if (!addrBad && !taxBad) continue;

  // Rebuild from whichever field still holds the full blob, so a value split
  // across the two fields is reassembled rather than half-cleaned.
  const combined = unwrap([addrBad ? d.merchantAddress : "", taxBad ? d.gstin : ""].filter(Boolean).join(" "));
  const { address, taxId } = split(combined);
  const patch = {};
  if (addrBad && address) patch.merchantAddress = address;
  if (taxBad && taxId) patch.gstin = taxId;
  else if (taxBad && !taxId) patch.gstin = "";
  if (!Object.keys(patch).length) continue;
  fixes.push({ id: d._id, invoiceNo: d.invoiceNo, before: { merchantAddress: d.merchantAddress, gstin: d.gstin }, patch });
}

console.log(`${fixes.length} invoice(s) need repair.\n`);
for (const f of fixes.slice(0, 5)) {
  console.log(`  ${f.invoiceNo || f.id}`);
  console.log(`    address  before: ${JSON.stringify(String(f.before.merchantAddress).slice(0, 90))}`);
  console.log(`             after : ${JSON.stringify(f.patch.merchantAddress ?? "(unchanged)")}`);
  console.log(`    gstin    before: ${JSON.stringify(String(f.before.gstin).slice(0, 90))}`);
  console.log(`             after : ${JSON.stringify(f.patch.gstin ?? "(unchanged)")}\n`);
}
if (fixes.length > 5) console.log(`  … and ${fixes.length - 5} more with the same shape.\n`);

if (!APPLY) {
  console.log("DRY RUN — nothing written. Re-run with --apply to repair.");
  process.exit(0);
}
if (!fixes.length) process.exit(0);

let batch = writeBatch(db);
let ops = 0;
for (const f of fixes) {
  batch.update(doc(db, "invoices", f.id), f.patch);
  if (++ops >= 400) { await batch.commit(); batch = writeBatch(db); ops = 0; }
}
if (ops) await batch.commit();
console.log(`Repaired ${fixes.length} invoice(s).`);
process.exit(0);
