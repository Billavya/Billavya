/**
 * End-to-end check of the campaign submission endpoints against the DEPLOYED
 * functions: save a submission, download both formats, and confirm the
 * access rules actually hold.
 *
 *   node scripts/test-campaign-submission-endpoints.mjs
 *
 * Writes a real campaignSubmissions doc (status submitted_awaiting_payment,
 * never paid) and prints its id so it can be removed if unwanted.
 */
import fs from "fs";
import { collection, getDocs, query, where } from "firebase/firestore";
import { firestore } from "./campaign-engine.mjs";

const SUBMIT = "https://us-central1-letsgetdirty.cloudfunctions.net/submitCampaignForm";
const DOWNLOAD = "https://us-central1-letsgetdirty.cloudfunctions.net/downloadCampaignSubmission";
const OUT = "/private/tmp/claude-501/-Users-ksphanindra/d23b7352-0b3f-4d0a-8fa4-4752e01ccdb3/scratchpad";

let failures = 0;
const check = (name, cond, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond || !detail ? "" : "  — " + detail}`);
  if (!cond) failures++;
};

const db = firestore();
async function keyFor(businessName) {
  const snap = await getDocs(query(collection(db, "merchants"), where("businessName", "==", businessName)));
  if (snap.empty) return null;
  return snap.docs[0].data().apiKey || null;
}

const apiKey = await keyFor("Naanna Restaurant");
if (!apiKey) throw new Error("No apiKey for Naanna Restaurant.");

const payload = {
  mode: "dense",
  tier: "premium",
  tierLabel: "Premium",
  duration: "2 weeks",
  validUntil: "2026-11-30",
  filters: { area: "Toronto", range: "Last 3 months" },
  manualCriteria: ["Endpoint test — safe to delete."],
  discountCodes: ["AVY-NAA-TEST-01"],
  priceDisplay: "$100/month",
  pricing: { mode: "dense", weeks: 2 },
  criteria: [
    { label: "Reach customers overdue for their usual visit", value: "7 days overdue", discountPct: 15, capAmount: 90, code: "AVY-NAA-TEST-01" },
    { label: "Quick-visit upgrade — mostly single-item visits", value: ">50% single-item", discountPct: 10, capAmount: null, code: null },
  ],
};

console.log("\n[1] submitCampaignForm");
const res = await fetch(SUBMIT, {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
const text = await res.text();
let json;
try { json = JSON.parse(text); } catch (_) {
  console.log(`  FAIL  returned JSON — HTTP ${res.status}: ${text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200)}`);
  process.exit(1);
}
check("HTTP 200", res.status === 200, `got ${res.status} ${JSON.stringify(json).slice(0, 160)}`);
check("returns a submissionId", !!json.submissionId);
check("returns a reference", /^AVY-SUB-/.test(json.reference || ""), json.reference);
check("returns a server timestamp", Number(json.submittedAtMs) > 0);
const id = json.submissionId;
console.log(`        submissionId=${id}  reference=${json.reference}`);

console.log("\n[2] auth");
const noAuth = await fetch(SUBMIT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
check("rejects a request with no API key", noAuth.status === 401, `got ${noAuth.status}`);
const badKey = await fetch(SUBMIT, { method: "POST", headers: { Authorization: "Bearer nope", "Content-Type": "application/json" }, body: JSON.stringify(payload) });
check("rejects a bad API key", badKey.status === 401, `got ${badKey.status}`);
const noCriteria = await fetch(SUBMIT, {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({ ...payload, criteria: [] }),
});
check("rejects a submission with no parameters", noCriteria.status === 422, `got ${noCriteria.status}`);

console.log("\n[3] downloadCampaignSubmission — PDF");
const pdfRes = await fetch(`${DOWNLOAD}?id=${encodeURIComponent(id)}&format=pdf`, { headers: { Authorization: `Bearer ${apiKey}` } });
const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
check("HTTP 200", pdfRes.status === 200, `got ${pdfRes.status}`);
check("content-type is application/pdf", (pdfRes.headers.get("content-type") || "").includes("application/pdf"));
check("sets a download filename", /attachment; filename=/.test(pdfRes.headers.get("content-disposition") || ""));
check("body is a real PDF", pdfBuf.subarray(0, 5).toString() === "%PDF-", pdfBuf.subarray(0, 12).toString());
if (pdfBuf.subarray(0, 5).toString() === "%PDF-") fs.writeFileSync(`${OUT}/live-submission.pdf`, pdfBuf);

console.log("\n[4] downloadCampaignSubmission — CSV");
const csvRes = await fetch(`${DOWNLOAD}?id=${encodeURIComponent(id)}&format=csv`, { headers: { Authorization: `Bearer ${apiKey}` } });
const csv = await csvRes.text();
check("HTTP 200", csvRes.status === 200, `got ${csvRes.status}`);
check("content-type is text/csv", (csvRes.headers.get("content-type") || "").includes("text/csv"));
check("carries the reference", csv.includes(json.reference));
check("carries the merchant", csv.includes("Naanna Restaurant"));
check("carries both parameters", payload.criteria.every((c) => csv.includes(c.label.slice(0, 28))));
check("records the awaiting-payment status", /awaiting payment/i.test(csv));
if (csvRes.status === 200) fs.writeFileSync(`${OUT}/live-submission.csv`, csv);

console.log("\n[5] a valid key must not reach another merchant's submission");
const otherKey = await keyFor("Amma");
if (!otherKey) {
  console.log("  SKIP  no second merchant with an apiKey to test against");
} else {
  const cross = await fetch(`${DOWNLOAD}?id=${encodeURIComponent(id)}&format=csv`, { headers: { Authorization: `Bearer ${otherKey}` } });
  check("another merchant's valid key is refused", cross.status === 403, `got ${cross.status}`);
}
const missing = await fetch(`${DOWNLOAD}?id=does-not-exist&format=pdf`, { headers: { Authorization: `Bearer ${apiKey}` } });
check("unknown id returns 404", missing.status === 404, `got ${missing.status}`);
const badFormat = await fetch(`${DOWNLOAD}?id=${encodeURIComponent(id)}&format=docx`, { headers: { Authorization: `Bearer ${apiKey}` } });
check("unsupported format returns 422", badFormat.status === 422, `got ${badFormat.status}`);

console.log(`\n${failures ? `${failures} FAILURE(S)` : "All checks passed."}`);
console.log(`Test submission left in campaignSubmissions/${id} (status: awaiting payment).`);
process.exit(failures ? 1 : 0);
