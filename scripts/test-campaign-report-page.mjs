/**
 * Exercises the generated picker page in a real DOM before it is published.
 *
 * This exists because the page was shipped three times broken — hardcoded
 * offer terms, a submit path that depended on a capability that resolves null
 * in a top-level view, and a render() that threw on every call because #cntOf
 * was nested inside #cnt (writing one deleted the other). Every one of those
 * was reachable by actually loading the page and clicking. `node --check` only
 * proves the file parses; it proves nothing about whether the page works.
 *
 * RUN THIS BEFORE EVERY PUBLISH. A non-zero exit means do not publish.
 *
 *   npm i -D jsdom     (once)
 *   node scripts/test-campaign-report-page.mjs
 */
import fs from "fs";
import os from "os";
import path from "path";
import { JSDOM, VirtualConsole } from "jsdom";

const file = path.join(os.homedir(), "avyaya-campaign-data", "naanna-restaurant", "campaign-report.html");
if (!fs.existsSync(file)) {
  console.error(`No generated page at ${file} — run scripts/build-campaign-report-page.mjs first.`);
  process.exit(1);
}

const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errors.push("uncaught: " + (e.detail?.message || e.message)));
vc.on("error", (...a) => errors.push("console.error: " + a.join(" ")));

const dom = new JSDOM(
  `<!doctype html><html><head><meta charset="utf-8"></head><body>${fs.readFileSync(file, "utf8")}</body></html>`,
  { runScripts: "dangerously", virtualConsole: vc, url: "https://example.invalid/" }
);
const { window } = dom;
const $ = (id) => window.document.getElementById(id);

let failures = 0;
const check = (name, cond, detail = "") => {
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? "  — " + detail : ""}`);
  }
};
const drainErrors = (stage) => {
  if (errors.length) {
    failures++;
    console.log(`  FAIL  no script errors during ${stage}`);
    errors.splice(0).forEach((e) => console.log(`          ${e}`));
  } else {
    console.log(`  PASS  no script errors during ${stage}`);
  }
};

const tick = (code) => {
  const cb = window.document.querySelector(`.prow[data-code="${code}"] .pick`);
  if (!cb) throw new Error(`no checkbox for ${code} — blocked parameters have none by design`);
  cb.checked = true;
  cb.dispatchEvent(new window.Event("change", { bubbles: true }));
};
const setField = (id, value) => {
  $(id).value = String(value);
  $(id).dispatchEvent(new window.Event("input", { bubbles: true }));
};

console.log("\n[1] load");
drainErrors("load");
check("checkboxes rendered", window.document.querySelectorAll(".pick").length > 0);
check("tray placeholder shown", /Select at least one/.test($("subBlock").textContent));

console.log("\n[2] ticking parameters updates everything");
["OVR", "QCK", "CAT"].forEach(tick);
drainErrors("ticking");
check("count is numeric and non-zero", /^[1-9]\d*$/.test($("cnt").textContent.trim()), `got ${JSON.stringify($("cnt").textContent)}`);
check("count suffix survived (the #cnt/#cntOf bug)", $("cntOf") !== null && /customers/.test($("cntOf").textContent));
check("audience list populated", /AVY-/.test($("audList").textContent));
check("copy block left the placeholder", !/Select at least one/.test($("subBlock").textContent));
check("copy block names the parameters", ["OVR", "QCK", "CAT"].every((c) => $("subBlock").textContent.includes(c)));
check("command names the parameters", ["OVR", "QCK", "CAT"].every((c) => $("cmd").textContent.includes(c)));
check("selected rows highlighted", window.document.querySelectorAll(".prow.on").length === 3);

console.log("\n[3] offer terms feed the command and the block");
setField("fDisc", 35);
setField("fCap", 17);
setField("fUntil", "2026-12-24");
drainErrors("editing terms");
check("discount reaches the command", $("cmd").textContent.includes("--discount 35"), $("cmd").textContent.slice(-60));
check("cap reaches the command", $("cmd").textContent.includes("--cap 17"));
check("end date reaches the command", $("cmd").textContent.includes("--until 2026-12-24"));
check("terms reach the copy block", /35%/.test($("subBlock").textContent) && /2026-12-24/.test($("subBlock").textContent));
check("offer preview reflects the discount", /35% OFF/.test($("poPct").textContent));

console.log("\n[4] discount presets");
window.document.querySelector('#presets button[data-pct="25"]').dispatchEvent(new window.Event("click", { bubbles: true }));
drainErrors("preset click");
check("preset sets the field", $("fDisc").value === "25");
check("preset reaches the command", $("cmd").textContent.includes("--discount 25"));

console.log("\n[5] each-separately mode");
window.document.querySelector('#modes button[data-mode="each"]').dispatchEvent(new window.Event("click", { bubbles: true }));
drainErrors("mode switch");
check("command carries --mode each", $("cmd").textContent.includes("--mode each"));
check("block carries the mode", /mode: each/.test($("subBlock").textContent));
check("per-parameter rows rendered", window.document.querySelectorAll(".each-row").length === 3);
check("total is the sum, not an intersection", Number($("cnt").textContent.trim()) > 3);

console.log("\n[6] back to match-all, then untick everything");
window.document.querySelector('#modes button[data-mode="and"]').dispatchEvent(new window.Event("click", { bubbles: true }));
check("match-all drops --mode each", !$("cmd").textContent.includes("--mode each"));
window.document.querySelectorAll(".pick").forEach((cb) => {
  if (!cb.checked) return;
  cb.checked = false;
  cb.dispatchEvent(new window.Event("change", { bubbles: true }));
});
drainErrors("unticking");
check("returns to the placeholder", /Select at least one/.test($("subBlock").textContent));
check("submit disabled with nothing selected", $("submitBtn").disabled === true);

console.log("\n[7] submit degrades without the db capability");
check("direct-submit stays hidden when use('db') is unavailable", $("directWrap").hidden === true);
check("copy path is present regardless", $("copySubBtn") !== null);

console.log(`\n${failures ? `${failures} FAILURE(S) — do not publish.` : "All checks passed."}`);
process.exit(failures ? 1 : 0);
