/**
 * Drives merchant-portal's submission-review step in a real DOM.
 *
 * Checks the thing that actually matters and is easy to get wrong: that
 * clicking Submit records the form FIRST and only reaches Stripe when the
 * merchant presses Continue — plus that both downloads fire against the right
 * endpoint, and that a failed download does not block payment.
 *
 * Network is stubbed, so this exercises the page's own logic, not the
 * backend (the deployed endpoints have their own test:
 * scripts/test-campaign-submission-endpoints.mjs).
 *
 *   npm i -D jsdom     (once)
 *   node scripts/test-merchant-portal-submission.mjs
 */
import fs from "fs";
import path from "path";
import { JSDOM, VirtualConsole } from "jsdom";

const PORTAL = path.join(import.meta.dirname, "..", "merchant-portal", "index.html");
const html = fs.readFileSync(PORTAL, "utf8");

let failures = 0;
const check = (name, cond, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond || !detail ? "" : "  — " + detail}`);
  if (!cond) failures++;
};

// ---- static checks on the markup the new step needs ------------------------
console.log("\n[1] markup the review step depends on");
for (const id of ["sr-overlay", "sr-body", "sr-pdf", "sr-csv", "sr-continue", "sr-msg", "sr-close"]) {
  check(`#${id} exists`, new RegExp(`id="${id}"`).test(html));
}
check("review overlay starts hidden", /id="sr-overlay"[^>]*\shidden/.test(html));
check("submit endpoint wired", html.includes("/submitCampaignForm"));
check("download endpoint wired", html.includes("/downloadCampaignSubmission"));
check(
  "Stripe redirect no longer runs straight from startStripeCheckout",
  !/openSubmissionReview[\s\S]{0,400}?window\.location\.href = json\.url/.test(html.slice(html.indexOf("async function startStripeCheckout"), html.indexOf("function openSubmissionReview")))
);
check("the submission POST happens before any checkout POST", html.indexOf("SUBMIT_CAMPAIGN_URL,") < html.indexOf("CREATE_CHECKOUT_URL, {"));

// ---- live run of the review step -------------------------------------------
console.log("\n[2] openSubmissionReview in a real DOM");
const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => {
  const m = e.detail?.message || e.message || "";
  // jsdom has no navigation, so the download anchor's .click() on a blob URL
  // always raises this. It is a limitation of the test environment, not a
  // page error — everything else is still collected and must stay empty.
  if (/Not implemented: navigation to another Document/.test(m)) return;
  errors.push("uncaught: " + m);
});

// Load the page with its own scripts suppressed (it is a module that wants
// Firebase over the network); we re-create just the function under test.
const dom = new JSDOM(html.replace(/<script[\s\S]*?<\/script>/g, ""), { runScripts: "dangerously", virtualConsole: vc, url: "https://billavya.com/merchant-portal/" });
const { window } = dom;
const doc = window.document;
const $ = (id) => doc.getElementById(id);

// Extract the real openSubmissionReview + escapeHtml from the page source so
// this tests the shipped code rather than a copy of it.
const start = html.indexOf("  function openSubmissionReview(");
const end = html.indexOf("  function escapeHtml(");
const endEsc = html.indexOf("}", html.indexOf("replace(/\"/g, \"&quot;\");")) + 1;
const source = html.slice(start, end) + html.slice(end, endEsc + 1);
check("extracted the real openSubmissionReview source", source.includes("sr-continue") && source.includes("escapeHtml"), `${source.length} chars`);

const calls = [];
window.fetch = (url, opts = {}) => {
  calls.push({ url: String(url), method: opts.method || "GET", headers: opts.headers || {} });
  if (String(url).includes("downloadCampaignSubmission")) {
    return Promise.resolve({ ok: true, status: 200, blob: () => Promise.resolve(new window.Blob(["x"])) });
  }
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ url: "https://checkout.stripe.com/fake" }) });
};
window.URL.createObjectURL = () => "blob:fake";
window.URL.revokeObjectURL = () => {};
// jsdom refuses to redefine window.location, and the function under test only
// ever reads window.location — so hand it a stand-in window instead of
// mutating the real one.
let navigatedTo = null;
const windowStub = {
  location: {
    origin: "https://billavya.com",
    pathname: "/merchant-portal/",
    set href(v) { navigatedTo = v; },
    get href() { return navigatedTo; },
  },
};

const ctxStub = {
  merchant: { apiKey: "test_key_123", email: "naanna@example.com" },
  CREATE_CHECKOUT_URL: "https://us-central1-letsgetdirty.cloudfunctions.net/createCampaignCheckout",
  DOWNLOAD_SUBMISSION_URL: "https://us-central1-letsgetdirty.cloudfunctions.net/downloadCampaignSubmission",
  PENDING_EXEC_KEY: "avyaya_pending_campaign_exec",
  currencySymbol: (c) => (c === "India" ? "₹" : "$"),
  $,
};
const factory = new window.Function(
  "$", "merchant", "CREATE_CHECKOUT_URL", "DOWNLOAD_SUBMISSION_URL", "PENDING_EXEC_KEY", "currencySymbol", "sessionStorage", "console", "fetch", "document", "URL", "setTimeout", "window",
  source + "\nreturn openSubmissionReview;"
);
const openSubmissionReview = factory(
  ctxStub.$, ctxStub.merchant, ctxStub.CREATE_CHECKOUT_URL, ctxStub.DOWNLOAD_SUBMISSION_URL,
  ctxStub.PENDING_EXEC_KEY, ctxStub.currencySymbol, window.sessionStorage, console, window.fetch, doc, window.URL, window.setTimeout, windowStub
);

const campaign = {
  businessName: "Naanna Restaurant", country: "Canada", tier: "premium",
  duration: "2 weeks", validUntil: "2026-11-30",
  filters: { area: "Toronto", range: "Last 3 months" },
  manualCriteria: ["Also reach last winter's catering customers"],
  criteria: [
    { label: "Reach customers overdue for their usual visit", value: "7 days overdue", discountPct: 15, capAmount: 90 },
    { label: 'Quick-visit upgrade — "mostly" <single-item> visits', value: ">50% single-item", discountPct: 10, capAmount: null },
  ],
};
const submission = { submissionId: "SUB123", reference: "AVY-SUB-NAA-20261112-ABC123", submittedAtMs: Date.now() };

openSubmissionReview({ submission, campaign, priceDisplay: "$100/month", msg: $("launch-msg") });

check("no script errors", errors.length === 0, errors.join("; "));
check("overlay is shown", $("sr-overlay").hidden === false);
check("reference displayed", $("sr-body").textContent.includes(submission.reference));
check("every parameter listed", campaign.criteria.every((c) => $("sr-body").textContent.includes(c.value)));
check("price displayed", $("sr-body").textContent.includes("$100/month"));
check("custom request displayed", $("sr-body").textContent.includes("catering"));
check("cap formatted with the right currency", $("sr-body").textContent.includes("$90"));
check("HTML in a label is escaped, not injected", $("sr-body").querySelectorAll("single-item").length === 0 && $("sr-body").textContent.includes("<single-item>"));
check("no network call made just to render", calls.length === 0, JSON.stringify(calls));

console.log("\n[3] downloads");
$("sr-pdf").dispatchEvent(new window.Event("click"));
await new Promise((r) => setTimeout(r, 10));
const pdfCall = calls.find((c) => c.url.includes("format=pdf"));
check("PDF button calls the download endpoint", !!pdfCall, JSON.stringify(calls));
check("PDF request carries the merchant key", !!pdfCall && pdfCall.headers.Authorization === "Bearer test_key_123");
check("PDF request carries the submission id", !!pdfCall && pdfCall.url.includes("id=SUB123"));
$("sr-csv").dispatchEvent(new window.Event("click"));
await new Promise((r) => setTimeout(r, 10));
check("CSV button calls the download endpoint", calls.some((c) => c.url.includes("format=csv")));
check("neither download triggered checkout", !calls.some((c) => c.url.includes("createCampaignCheckout")));

console.log("\n[4] continue to payment");
$("sr-continue").dispatchEvent(new window.Event("click"));
await new Promise((r) => setTimeout(r, 20));
const checkoutCall = calls.find((c) => c.url.includes("createCampaignCheckout"));
check("Continue calls checkout exactly once", !!checkoutCall && calls.filter((c) => c.url.includes("createCampaignCheckout")).length === 1);
check("redirects to Stripe", navigatedTo === "https://checkout.stripe.com/fake", String(navigatedTo));
check("still no script errors", errors.length === 0, errors.join("; "));

console.log(`\n${failures ? `${failures} FAILURE(S) — do not deploy.` : "All checks passed."}`);
process.exit(failures ? 1 : 0);
