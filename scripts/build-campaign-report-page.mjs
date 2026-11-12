/**
 * Renders the prepared dataset's report.json into a single self-contained HTML
 * page — the thing a merchant (or you) actually looks at to choose campaign
 * parameters.
 *
 * The page embeds, for every parameter AND every option value, the exact list
 * of customer ids the engine matched. That is what lets the page intersect
 * selections client-side and show a true audience with no backend: the numbers
 * it shows are the numbers run-campaign.mjs will produce, because they come
 * from the same evaluation.
 *
 *   node scripts/build-campaign-report-page.mjs ["Merchant Name"]
 */
import fs from "fs";
import path from "path";
import { reportPath, datasetDir } from "./campaign-engine.mjs";

const MERCHANT = process.argv[2] || "Naanna Restaurant";
const rp = reportPath(MERCHANT);
if (!fs.existsSync(rp)) throw new Error(`No report at ${rp}. Run: node scripts/campaign-dataset.mjs "${MERCHANT}"`);
const R = JSON.parse(fs.readFileSync(rp, "utf8"));

const OUT = path.join(datasetDir(MERCHANT), "campaign-report.html");

// Objective + tier colors lifted conceptually from merchant-portal/index.html
// so this page reads as part of the same product, not a separate tool.
const OBJ = {
  retention: { label: "Retention", color: "#2563EB" },
  growth: { label: "Growth & Upsell", color: "#16A34A" },
  acquisition: { label: "Acquisition", color: "#EA580C" },
  occasion: { label: "Occasion & Channel", color: "#DB2777" },
};
const TIER = { basic: "#0F766E", standard: "#142850", premium: "#7A1F3D" };

const BLOCK_REASON = {
  not_trackable: "No underlying events exist yet (referrals, abandoned carts, buy-1-get mechanics). Needs product work, not data.",
  needs_item_categories: "Needs per-item category tags. Every Clover line item arrives with category: null — tag your menu in Clover's inventory and this lights up.",
  needs_profile_access: "Needs read access to customer profiles (birth month). Firestore rules currently deny it to this tool.",
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const d = (ms) => new Date(ms).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
const money = (n) => "$" + Number(n).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ready = R.parameters.filter((p) => !p.blockedBy && p.maxReach > 0);
const empty = R.parameters.filter((p) => !p.blockedBy && p.maxReach === 0);
const blocked = R.parameters.filter((p) => p.blockedBy);

const maxDow = Math.max(...R.byDow.map((x) => x.invoices));
const maxHour = Math.max(...R.byHour.map((x) => x.invoices));
const maxDate = Math.max(...R.byDate.map((x) => x.invoices));
const realItems = R.items.filter((i) => !i.isTestArtifact);
const maxItemRev = Math.max(...realItems.map((i) => i.revenue), 1);

const PAYLOAD = {
  merchant: R.merchant.businessName,
  customerIds: R.customers.map((c) => c.avyayaId),
  customers: R.customers,
  parameters: R.parameters.map((p) => ({
    code: p.code, label: p.label, objective: p.objective, tier: p.tier,
    blockedBy: p.blockedBy, evaluable: p.evaluable, maxReach: p.maxReach,
    options: p.options.map((o) => ({ value: o.value, reach: o.reach, matched: o.matched, evaluable: o.evaluable })),
  })),
};

const paramRow = (p) => {
  const o = OBJ[p.objective] || OBJ.growth;
  const pctOf = (n) => (R.totals.customers ? Math.round((n / R.totals.customers) * 100) : 0);
  const disabled = !!p.blockedBy;
  return `
  <tr class="prow${disabled ? " is-blocked" : ""}" data-code="${esc(p.code)}">
    <td class="c-pick">${disabled ? '<span class="lock" title="Not available with today\'s data">—</span>'
      : `<input type="checkbox" class="pick" id="pick-${esc(p.code)}" aria-label="Select ${esc(p.label)}">`}</td>
    <td class="c-code"><code>${esc(p.code)}</code></td>
    <td class="c-label">
      <label ${disabled ? "" : `for="pick-${esc(p.code)}"`}>${esc(p.label)}</label>
      <div class="c-meta">
        <span class="dot" style="background:${o.color}"></span>${esc(o.label)}
        <span class="tier" style="color:${TIER[p.tier]};border-color:${TIER[p.tier]}33">${esc(p.tier)}</span>
      </div>
      ${disabled ? `<div class="blocked-why">${esc(BLOCK_REASON[p.blockedBy] || p.blockedBy)}</div>` : ""}
    </td>
    <td class="c-value">${disabled ? "<span class=\"muted\">unavailable</span>"
      : `<select class="val" data-code="${esc(p.code)}" aria-label="Value for ${esc(p.label)}">
          ${p.options.map((opt) => `<option value="${esc(opt.value)}"${opt.value === p.bestValue ? " selected" : ""}>${esc(opt.value)} — ${opt.reach}</option>`).join("")}
        </select>`}</td>
    <td class="c-reach">
      <div class="bar" aria-hidden="true"><span style="width:${pctOf(p.maxReach)}%;background:${disabled ? "#9aa4b2" : o.color}"></span></div>
      <b class="reach-n">${p.maxReach}</b><span class="muted">/${R.totals.customers}</span>
    </td>
  </tr>`;
};

const html = `<title>Naanna Sales &amp; Campaign Picker</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>
  :root{
    --bg:#F4F6FA; --surface:#FFFFFF; --surface-2:#FAFBFD; --line:#E2E7F0; --line-2:#CFD7E6;
    --ink:#101A2C; --ink-2:#3E4A61; --muted:#6B7788; --muted-2:#8D97A8;
    --navy:#142850; --teal:#0F766E; --premium:#7A1F3D;
    --good:#16A34A; --warn:#B45309; --warn-bg:#FEF6E7; --stop:#B42318; --stop-bg:#FDF2F1;
    --shadow:0 1px 2px rgba(16,26,44,.06), 0 8px 24px -12px rgba(16,26,44,.18);
  }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      --bg:#0C1220; --surface:#141C2E; --surface-2:#182135; --line:#263150; --line-2:#334162;
      --ink:#EEF2F9; --ink-2:#C2CBDB; --muted:#93A0B6; --muted-2:#76839B;
      --navy:#9FB6E0; --teal:#4FBFAF; --premium:#E291AC;
      --good:#4ADE80; --warn:#FBBF24; --warn-bg:#2A2110; --stop:#F87171; --stop-bg:#2A1515;
      --shadow:0 1px 2px rgba(0,0,0,.4), 0 10px 30px -12px rgba(0,0,0,.6);
    }
  }
  :root[data-theme="dark"]{
    --bg:#0C1220; --surface:#141C2E; --surface-2:#182135; --line:#263150; --line-2:#334162;
    --ink:#EEF2F9; --ink-2:#C2CBDB; --muted:#93A0B6; --muted-2:#76839B;
    --navy:#9FB6E0; --teal:#4FBFAF; --premium:#E291AC;
    --good:#4ADE80; --warn:#FBBF24; --warn-bg:#2A2110; --stop:#F87171; --stop-bg:#2A1515;
    --shadow:0 1px 2px rgba(0,0,0,.4), 0 10px 30px -12px rgba(0,0,0,.6);
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:"Inter",-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}
  h1,h2,h3{font-family:"Sora","Inter",sans-serif;margin:0;text-wrap:balance}
  code,.mono,.num{font-family:"IBM Plex Mono",ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums}
  .wrap{max-width:1240px;margin:0 auto;padding:22px 20px 72px}
  a{color:var(--teal)}

  /* ---- masthead ---- */
  .mast{background:var(--navy);color:#fff;border-radius:14px;padding:20px 22px;box-shadow:var(--shadow)}
  :root[data-theme="dark"] .mast, :root:not([data-theme="light"]) .mast{background:linear-gradient(180deg,#1B2745,#141C2E)}
  @media (prefers-color-scheme: light){:root:not([data-theme="dark"]) .mast{background:var(--navy)}}
  .mast h1{font-size:21px;font-weight:800;color:#fff;letter-spacing:-.01em}
  .mast .sub{margin-top:5px;font-size:12.5px;color:#B9C6E0;display:flex;flex-wrap:wrap;gap:4px 14px;align-items:center}
  .mast .sub b{color:#fff;font-weight:600}
  .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:1px;margin-top:18px;background:rgba(255,255,255,.14);border-radius:10px;overflow:hidden}
  .kpi{background:rgba(10,18,34,.34);padding:11px 13px}
  .kpi .v{font-family:"IBM Plex Mono",monospace;font-size:19px;font-weight:600;color:#fff;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
  .kpi .k{font-size:9.5px;text-transform:uppercase;letter-spacing:.09em;color:#A9B8D4;margin-top:2px}

  section{margin-top:26px}
  .sec-head{display:flex;align-items:baseline;gap:11px;margin-bottom:11px;flex-wrap:wrap}
  .sec-head h2{font-size:15.5px;font-weight:700;color:var(--ink)}
  .sec-head p{margin:0;font-size:12.5px;color:var(--muted);max-width:62ch}
  .card{background:var(--surface);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow)}

  /* ---- picker layout ---- */
  .picker{display:grid;grid-template-columns:minmax(0,1fr) 322px;gap:16px;align-items:start}
  @media (max-width:1000px){.picker{grid-template-columns:minmax(0,1fr)}}
  .tbl-scroll{overflow-x:auto}
  table.params{width:100%;border-collapse:collapse;min-width:680px}
  table.params th{text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted-2);font-weight:600;padding:10px 10px;border-bottom:1px solid var(--line);background:var(--surface-2);position:sticky;top:0;z-index:1}
  table.params td{padding:10px;border-bottom:1px solid var(--line);vertical-align:top}
  table.params tr:last-child td{border-bottom:0}
  .prow:hover{background:var(--surface-2)}
  .prow.is-blocked{opacity:.62}
  .prow.on{background:color-mix(in srgb,var(--teal) 7%,transparent)}
  .c-pick{width:34px;text-align:center}
  .c-pick input{width:16px;height:16px;accent-color:var(--teal);cursor:pointer}
  .lock{color:var(--muted-2)}
  .c-code{width:52px}
  .c-code code{font-size:11px;font-weight:600;color:var(--ink-2);background:var(--surface-2);border:1px solid var(--line);border-radius:5px;padding:2px 5px}
  .c-label label{font-size:13px;font-weight:500;color:var(--ink);cursor:pointer;display:block;max-width:46ch}
  .c-meta{display:flex;align-items:center;gap:7px;margin-top:5px;font-size:10.5px;color:var(--muted)}
  .dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:3px}
  .tier{border:1px solid;border-radius:20px;padding:1px 7px;font-size:9.5px;font-weight:600;text-transform:capitalize}
  .blocked-why{margin-top:6px;font-size:11px;color:var(--warn);background:var(--warn-bg);border-radius:6px;padding:5px 7px;max-width:52ch}
  .c-value{width:188px}
  select.val{width:100%;font:inherit;font-size:12px;padding:5px 7px;border:1px solid var(--line-2);border-radius:7px;background:var(--surface);color:var(--ink)}
  .c-reach{width:118px;text-align:right;white-space:nowrap}
  .bar{height:5px;background:var(--line);border-radius:3px;overflow:hidden;margin-bottom:5px}
  .bar span{display:block;height:100%;border-radius:3px}
  .reach-n{font-family:"IBM Plex Mono",monospace;font-size:13px;font-variant-numeric:tabular-nums}
  .muted{color:var(--muted)}

  /* ---- tray ---- */
  .tray{position:sticky;top:14px;padding:15px;display:flex;flex-direction:column;gap:13px}
  .tray h3{font-size:13px;font-weight:700}
  .tray .count{font-family:"IBM Plex Mono",monospace;font-size:34px;font-weight:600;color:var(--teal);line-height:1;font-variant-numeric:tabular-nums}
  .tray .count small{font-size:13px;color:var(--muted);font-weight:400}
  .sel-list{display:flex;flex-direction:column;gap:6px}
  .sel-chip{display:flex;gap:7px;align-items:flex-start;font-size:11.5px;background:var(--surface-2);border:1px solid var(--line);border-radius:7px;padding:6px 8px}
  .sel-chip code{font-size:10px;font-weight:600;color:var(--ink-2)}
  .sel-chip .v{color:var(--teal);font-weight:600}
  .aud{display:flex;flex-direction:column;gap:4px}
  .aud-row{display:flex;justify-content:space-between;gap:8px;font-size:11.5px;padding:4px 7px;background:var(--surface-2);border-radius:6px}
  .aud-row .id{font-family:"IBM Plex Mono",monospace;font-weight:500}
  .cmd{background:#0B1120;color:#D7E3F7;border-radius:9px;padding:10px;font-family:"IBM Plex Mono",monospace;font-size:10.5px;line-height:1.65;overflow-x:auto;white-space:pre;border:1px solid #1E293B}
  .hint{font-size:11px;color:var(--muted)}
  .skipnote{font-size:11px;color:var(--warn);background:var(--warn-bg);border-radius:6px;padding:6px 8px}
  button.copy{font:inherit;font-size:11.5px;font-weight:600;padding:7px 11px;border-radius:7px;border:1px solid var(--line-2);background:var(--surface);color:var(--ink);cursor:pointer}
  button.copy:hover{border-color:var(--teal);color:var(--teal)}
  button.copy:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--teal);outline-offset:2px}

  /* ---- charts + tables ---- */
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  @media (max-width:840px){.grid2{grid-template-columns:1fr}}
  .card-pad{padding:15px}
  .chart{display:flex;flex-direction:column;gap:7px}
  .crow{display:grid;grid-template-columns:76px 1fr 84px;gap:9px;align-items:center;font-size:12px}
  .crow .cl{color:var(--ink-2)}
  .crow .cb{height:17px;background:var(--line);border-radius:4px;overflow:hidden}
  .crow .cb span{display:block;height:100%;background:var(--teal);border-radius:4px}
  .crow .cv{text-align:right;font-family:"IBM Plex Mono",monospace;font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums}
  .crow.flag .cb span{background:var(--warn)}
  table.data{width:100%;border-collapse:collapse}
  table.data th{text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted-2);font-weight:600;padding:9px 11px;border-bottom:1px solid var(--line)}
  table.data td{padding:9px 11px;border-bottom:1px solid var(--line);font-size:12.5px}
  table.data tr:last-child td{border-bottom:0}
  table.data td.n,table.data th.n{text-align:right;font-family:"IBM Plex Mono",monospace;font-variant-numeric:tabular-nums}
  .idcell{font-family:"IBM Plex Mono",monospace;font-size:11.5px;font-weight:500}
  .pill{display:inline-block;font-size:10px;padding:1px 6px;border-radius:20px;border:1px solid var(--line-2);color:var(--muted);margin:1px 2px 1px 0}
  .note{border-left:3px solid var(--warn);background:var(--warn-bg);border-radius:0 8px 8px 0;padding:11px 13px;font-size:12.5px;color:var(--ink-2)}
  .note.stop{border-color:var(--stop);background:var(--stop-bg)}
  .note b{color:var(--ink)}
  .gaps{display:flex;flex-direction:column;gap:9px}
  .gap{display:grid;grid-template-columns:22px 1fr;gap:10px;font-size:12.5px;padding:11px 13px;border:1px solid var(--line);border-radius:9px;background:var(--surface)}
  .gap .ic{font-size:14px;line-height:1.2}
  .gap b{display:block;margin-bottom:2px}
  .gap .fix{color:var(--muted);font-size:11.5px;margin-top:3px}
  footer{margin-top:34px;padding-top:15px;border-top:1px solid var(--line);font-size:11.5px;color:var(--muted-2)}
</style>

<div class="wrap">

  <div class="mast">
    <h1>${esc(R.merchant.businessName)} — sales &amp; campaign picker</h1>
    <div class="sub">
      <span><b>${esc(R.category)}</b> · ${esc(R.merchant.country)} · ${esc(R.merchant.city)}</span>
      <span>${d(R.totals.firstMs)} → ${d(R.totals.lastMs)} <b>(${R.totals.spanDays} days)</b></span>
      <span>source: <b>Clover sandbox → cloverWebhook</b></span>
      <span>built <b>${d(R.generatedAtMs)}</b></span>
    </div>
    <div class="kpis">
      <div class="kpi"><div class="v">${R.totals.invoices}</div><div class="k">Invoices</div></div>
      <div class="kpi"><div class="v">${R.totals.customers}</div><div class="k">Customers</div></div>
      <div class="kpi"><div class="v">${money(R.totals.gross)}</div><div class="k">Gross</div></div>
      <div class="kpi"><div class="v">${money(R.totals.avgTicket)}</div><div class="k">Avg ticket</div></div>
      <div class="kpi"><div class="v">${R.totals.repeatCustomers}/${R.totals.customers}</div><div class="k">Repeat</div></div>
      <div class="kpi"><div class="v">${R.totals.distinctItems}</div><div class="k">Menu items</div></div>
      <div class="kpi"><div class="v">${ready.length}/${R.parameters.length}</div><div class="k">Params ready</div></div>
    </div>
  </div>

  <section>
    <div class="note stop"><b>Read the sample size before you read anything else.</b>
      This is ${R.totals.customers} customers over ${R.totals.spanDays} days of sandbox testing — enough to prove the targeting machinery runs correctly end to end, not enough to draw commercial conclusions from.
      ${money(R.totals.testArtifactRevenue)} of the ${money(R.totals.gross)} gross comes from items named like "Test Item" and "Webhook Test Item", and the 11 PM revenue spike below is us testing, not diners.
      Every reach number here is real and recomputed from the live engine — just against a tiny book.</div>
  </section>

  <section>
    <div class="sec-head">
      <h2>Pick your parameters</h2>
      <p>Tick parameters and choose a value — the panel shows the exact audience, intersected live. Each option's own reach is in its dropdown.</p>
    </div>
    <div class="picker">
      <div class="card tbl-scroll">
        <table class="params">
          <thead><tr><th></th><th>Code</th><th>Parameter</th><th>Value</th><th class="n">Best reach</th></tr></thead>
          <tbody>
            ${[...ready].sort((a, b) => b.maxReach - a.maxReach).map(paramRow).join("")}
            ${empty.map(paramRow).join("")}
            ${blocked.map(paramRow).join("")}
          </tbody>
        </table>
      </div>

      <div class="card tray">
        <div>
          <h3>Your audience</h3>
          <div class="count" id="cnt">0<small id="cntOf"> / ${R.totals.customers} customers</small></div>
        </div>
        <div class="sel-list" id="selList"><p class="hint">Nothing selected. Tick a parameter to build an audience.</p></div>
        <div id="skipWrap"></div>
        <div class="aud" id="audList"></div>
        <div>
          <h3 style="margin-bottom:7px">Command to run it</h3>
          <div class="cmd" id="cmd">Select at least one parameter.</div>
          <div style="display:flex;gap:7px;margin-top:8px;align-items:center">
            <button class="copy" id="copyBtn" type="button">Copy command</button>
            <span class="hint" id="copyNote"></span>
          </div>
          <p class="hint" style="margin-top:8px">Runs a dry run. Add <code>--push</code> to actually send the offers.</p>
        </div>
      </div>
    </div>
  </section>

  <section>
    <div class="sec-head"><h2>When the sales happen</h2><p>What the 83 invoices look like across the week and the clock.</p></div>
    <div class="grid2">
      <div class="card card-pad">
        <h3 style="font-size:12.5px;margin-bottom:11px">By day of week</h3>
        <div class="chart">
          ${R.byDow.map((x) => `<div class="crow"><span class="cl">${esc(x.day)}</span><span class="cb"><span style="width:${maxDow ? (x.invoices / maxDow) * 100 : 0}%"></span></span><span class="cv">${x.invoices} · ${money(x.revenue)}</span></div>`).join("")}
        </div>
      </div>
      <div class="card card-pad">
        <h3 style="font-size:12.5px;margin-bottom:11px">By hour <span class="muted" style="font-weight:400;font-size:11px">— amber = test traffic, not diners</span></h3>
        <div class="chart">
          ${R.byHour.map((x) => `<div class="crow${x.hour >= 23 || x.hour <= 1 ? " flag" : ""}"><span class="cl">${String(x.hour).padStart(2, "0")}:00</span><span class="cb"><span style="width:${maxHour ? (x.invoices / maxHour) * 100 : 0}%"></span></span><span class="cv">${x.invoices} · ${money(x.revenue)}</span></div>`).join("")}
        </div>
      </div>
    </div>
  </section>

  <section>
    <div class="sec-head"><h2>Daily volume</h2><p>Every day with at least one sale.</p></div>
    <div class="card card-pad">
      <div class="chart">
        ${R.byDate.map((x) => `<div class="crow"><span class="cl">${esc(x.date.slice(5))}</span><span class="cb"><span style="width:${maxDate ? (x.invoices / maxDate) * 100 : 0}%"></span></span><span class="cv">${x.invoices} · ${money(x.revenue)}</span></div>`).join("")}
      </div>
    </div>
  </section>

  <section>
    <div class="sec-head"><h2>Your customers</h2><p>All ${R.totals.customers}, with the behaviour the retention and upsell parameters read.</p></div>
    <div class="card tbl-scroll">
      <table class="data">
        <thead><tr><th>Avyaya ID</th><th class="n">Visits</th><th class="n">Lifetime</th><th class="n">Avg</th><th class="n">Last seen</th><th class="n">Avg gap</th><th>Usual day</th><th class="n">Single-item</th><th>Menu categories bought</th></tr></thead>
        <tbody>
          ${R.customers.map((c) => `<tr>
            <td class="idcell">${esc(c.avyayaId)}</td>
            <td class="n">${c.invoices}</td>
            <td class="n">${money(c.lifetimeSpend)}</td>
            <td class="n">${money(c.avgTicket)}</td>
            <td class="n">${c.daysSinceLast === 0 ? "today" : c.daysSinceLast + "d"}</td>
            <td class="n">${c.avgGapDays === null ? "—" : c.avgGapDays + "d"}</td>
            <td>${c.usualDay ? esc(c.usualDay) : '<span class="muted">—</span>'}</td>
            <td class="n">${c.singleItemVisits}/${c.invoices}</td>
            <td>${c.derivedCategories.length ? c.derivedCategories.map((x) => `<span class="pill">${esc(x)}</span>`).join("") : '<span class="muted">—</span>'}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
    <p class="hint" style="margin-top:8px">"Menu categories bought" is <b>derived from item names</b> using the portal's own keyword map, because Clover sends every line item with <code>category: null</code>. It is a best-effort read, not a tagged fact.</p>
  </section>

  <section>
    <div class="sec-head"><h2>What sells</h2><p>Real menu items by revenue. Test artifacts excluded.</p></div>
    <div class="card tbl-scroll">
      <table class="data">
        <thead><tr><th>Item</th><th class="n">Qty</th><th class="n">Revenue</th><th>Share</th><th>Derived category</th></tr></thead>
        <tbody>
          ${realItems.map((i) => `<tr>
            <td>${esc(i.name)}</td>
            <td class="n">${i.qty}</td>
            <td class="n">${money(i.revenue)}</td>
            <td style="width:150px"><div class="bar"><span style="width:${(i.revenue / maxItemRev) * 100}%;background:var(--teal)"></span></div></td>
            <td>${i.derivedCategory ? `<span class="pill">${esc(i.derivedCategory)}</span>` : '<span class="muted">unmatched</span>'}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  </section>

  <section>
    <div class="sec-head"><h2>What's blocking the other parameters</h2><p>${blocked.length + empty.length} of ${R.parameters.length} parameters can't produce an audience from this data. Here's exactly why, and what unblocks each.</p></div>
    <div class="gaps">
      <div class="gap"><span class="ic">🏷️</span><div><b>No item categories on any line item (${R.totals.itemLinesTagged}/${R.totals.itemLinesTotal} tagged)</b>
        Clover sends <code>category: null</code> for every item, so the two attach-rate parameters (<code>DRY</code>, <code>ATC</code>) can't run, and the menu-category ones (<code>CAT</code>, <code>GAP</code>) fall back to guessing from item names.
        <div class="fix">Fix: tag your items into categories in Clover's own inventory setup. That one change turns 4 parameters from guessed to exact.</div></div></div>
      <div class="gap"><span class="ic">🔒</span><div><b>Customer profiles aren't readable by this tool</b>
        Birthday / anniversary targeting (<code>BDAY</code>) needs each customer's birth month. Firestore rules deny this script that read.
        <div class="fix">Fix: run the match inside a Cloud Function (which reads with admin rights) instead of from a script.</div></div></div>
      <div class="gap"><span class="ic">💱</span><div><b>"Spent more than ___" uses rupee-scaled amounts (<code>SPD</code>)</b>
        Its options are 500 / 1,000 / 2,500 / 5,000 / 10,000 — sensible in ₹, meaningless against a ${money(R.totals.avgTicket)} Canadian average ticket, so it matches nobody.
        <div class="fix">Fix: make the amount options currency-aware in the portal. A Canada ladder of 15 / 25 / 50 / 100 / 200 would actually target.</div></div></div>
      <div class="gap"><span class="ic">🐛</span><div><b>"Top spenders by lifetime value" is broken in the live portal (<code>LTV</code>)</b>
        It parses its own option label with <code>parseInt("Top 5%")</code>, which is <code>NaN</code> — so the cutoff is <code>NaN</code> and the qualifying set is always empty. A paid Premium parameter that can never fire. This page works around it, so the reach you see here is the real one.
        <div class="fix">Fix: one line in <code>merchant-portal/index.html</code> — pull the digits out of the label before dividing.</div></div></div>
      <div class="gap"><span class="ic">📦</span><div><b>No events behind 4 parameters</b>
        Referrals (<code>REF</code>), abandoned carts (<code>ABN</code>) and the two buy-1-get mechanics (<code>BG1</code>, <code>BG2</code>) have no underlying data in the product at all — they're product work, not a data gap.
        <div class="fix">Fix: these stay unavailable until the app emits those events. They're correctly marked unavailable rather than quietly matching nobody.</div></div></div>
      <div class="gap"><span class="ic">👤</span><div><b>Cashier and order type carry no signal</b>
        Every invoice says <code>orderType: "Walk-in"</code> and no cashier name (the employee lookup returns 401), so "preferred order type" can only ever say "Any".
        <div class="fix">Fix: grant the Clover app the employee read scope; order type needs Clover's own dine-in/takeaway distinction to come through.</div></div></div>
    </div>
  </section>

  <footer>
    Generated ${d(R.generatedAtMs)} from <code>~/avyaya-campaign-data/${esc(R.merchant.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}/report.json</code>.
    Reach figures come from the live matching engine lifted out of <code>merchant-portal/index.html</code> — the same code the paid builder runs, so these numbers are what a real campaign would hit.
    Refresh with <code>node scripts/campaign-dataset.mjs</code> after new sales.
  </footer>
</div>

<script>
const DATA = ${JSON.stringify(PAYLOAD)};
const BY_CODE = {};
DATA.parameters.forEach(p => BY_CODE[p.code] = p);
const CUST = {};
DATA.customers.forEach(c => CUST[c.avyayaId] = c);

function selection(){
  const out = [];
  document.querySelectorAll('.pick').forEach(cb => {
    if(!cb.checked) return;
    const code = cb.closest('.prow').dataset.code;
    const sel = document.querySelector('select.val[data-code="'+code+'"]');
    const p = BY_CODE[code];
    const opt = p.options.find(o => o.value === sel.value);
    if(opt) out.push({ code, label:p.label, value:opt.value, matched:opt.matched, evaluable:opt.evaluable });
  });
  return out;
}

// Option labels are a closed set from CRITERIA_DATA ("30 days", "Top 20%",
// ">50% single-item", "Main Course") — no quotes or shell metacharacters ever
// appear in them, so plain double-quoting is sufficient and needs no escaping.
function shellQuote(s){ return /^[A-Za-z0-9_.:%=>-]+$/.test(s) ? s : '"' + s + '"'; }

function render(){
  const sel = selection();
  document.querySelectorAll('.prow').forEach(r => {
    const cb = r.querySelector('.pick');
    r.classList.toggle('on', !!(cb && cb.checked));
  });

  const list = document.getElementById('selList');
  const audEl = document.getElementById('audList');
  const skipWrap = document.getElementById('skipWrap');
  const cmdEl = document.getElementById('cmd');

  if(!sel.length){
    list.innerHTML = '<p class="hint">Nothing selected. Tick a parameter to build an audience.</p>';
    audEl.innerHTML = '';
    skipWrap.innerHTML = '';
    document.getElementById('cnt').textContent = '0';
    document.getElementById('cntOf').textContent = ' / ' + DATA.customerIds.length + ' customers';
    cmdEl.textContent = 'Select at least one parameter.';
    return;
  }

  list.innerHTML = sel.map(s =>
    '<div class="sel-chip"><code>'+s.code+'</code><span><span class="v">'+s.value+'</span><br>'+s.label+'</span></div>'
  ).join('');

  // Intersect only the parameters that can actually be evaluated. A
  // non-evaluable one is skipped rather than excluding everyone — exactly what
  // run-campaign.mjs does with a null result.
  const usable = sel.filter(s => s.evaluable);
  const skipped = sel.filter(s => !s.evaluable);
  let audience = DATA.customerIds.slice();
  usable.forEach(s => { const m = new Set(s.matched); audience = audience.filter(id => m.has(id)); });

  skipWrap.innerHTML = skipped.length
    ? '<div class="skipnote">Skipped (can\\'t be computed, so it did not exclude anyone): ' + skipped.map(s=>s.code).join(', ') + '</div>'
    : '';

  document.getElementById('cnt').textContent = String(audience.length);
  document.getElementById('cntOf').textContent = ' / ' + DATA.customerIds.length + ' customers';

  audEl.innerHTML = audience.length
    ? audience.map(id => {
        const c = CUST[id] || {};
        return '<div class="aud-row"><span class="id">'+id+'</span><span class="muted">'+(c.invoices||0)+' visits · $'+(c.lifetimeSpend||0).toFixed(2)+'</span></div>';
      }).join('')
    : '<div class="aud-row"><span class="muted">No customer satisfies every selected parameter.</span></div>';

  cmdEl.textContent = 'node scripts/run-campaign.mjs \\\\\\n' +
    sel.map(s => '  --param ' + s.code + '=' + shellQuote(s.value)).join(' \\\\\\n') +
    ' \\\\\\n  --discount 20 --cap 50';
}

document.addEventListener('change', e => {
  if(e.target.classList.contains('pick') || e.target.classList.contains('val')) render();
});
document.getElementById('copyBtn').addEventListener('click', async () => {
  const note = document.getElementById('copyNote');
  try{
    await navigator.clipboard.writeText(document.getElementById('cmd').textContent);
    note.textContent = 'Copied.';
  }catch(_){
    note.textContent = 'Select and copy manually.';
  }
  setTimeout(()=>{ note.textContent=''; }, 2200);
});
render();
</script>
`;

fs.writeFileSync(OUT, html);
console.log(`Wrote ${OUT} (${(html.length / 1024).toFixed(1)} KB)`);
console.log(`  ready: ${ready.length} · no-match: ${empty.length} · blocked: ${blocked.length} of ${R.parameters.length} parameters`);
