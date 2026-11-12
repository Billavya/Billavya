// Drives the generated picker page in a real DOM: ticks three parameters,
// fires the change event the page listens for, and reads back what the copy
// block would actually contain. Surfaces any script error instead of letting
// it silently leave the placeholder text in place.
import fs from "fs";
import os from "os";
import path from "path";
import { JSDOM, VirtualConsole } from "jsdom";

const file = path.join(os.homedir(), "avyaya-campaign-data", "naanna-restaurant", "campaign-report.html");
const body = fs.readFileSync(file, "utf8");
const doc = `<!doctype html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`;

const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errors.push("jsdomError: " + (e.detail?.stack || e.message)));
vc.on("error", (...a) => errors.push("console.error: " + a.join(" ")));

const dom = new JSDOM(doc, { runScripts: "dangerously", virtualConsole: vc, url: "https://example.invalid/" });
const { window } = dom;
const $ = (id) => window.document.getElementById(id);

console.log("=== script errors at load ===");
console.log(errors.length ? errors.join("\n") : "(none)");

const picks = [...window.document.querySelectorAll(".pick")];
console.log(`\ncheckboxes found: ${picks.length}`);
console.log(`subBlock at load: ${JSON.stringify($("subBlock").textContent.slice(0, 60))}`);

// Tick three, exactly as a user would, firing the same event the page binds.
const chosen = ["OVR", "QCK", "CAT"];
for (const code of chosen) {
  const row = window.document.querySelector(`.prow[data-code="${code}"]`);
  const cb = row.querySelector(".pick");
  cb.checked = true;
  cb.dispatchEvent(new window.Event("change", { bubbles: true }));
}

console.log("\n=== after ticking " + chosen.join(", ") + " ===");
console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "(no errors)");
console.log("count       :", $("cnt").textContent, $("cntOf").textContent);
console.log("audience    :", $("audList").textContent.trim().slice(0, 200));
console.log("\nsubBlock:\n" + $("subBlock").textContent);
console.log("\ncmd:\n" + $("cmd").textContent);

// And the 'each' mode path.
const eachBtn = window.document.querySelector('#modes button[data-mode="each"]');
eachBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
console.log("\n=== after switching to 'Each separately' ===");
console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "(no errors)");
console.log("count       :", $("cnt").textContent, $("cntOf").textContent);
console.log("subBlock:\n" + $("subBlock").textContent);
