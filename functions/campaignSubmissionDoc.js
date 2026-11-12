// =============================================================================
// Campaign submission record — the merchant's own copy of exactly what they
// submitted, produced BEFORE payment (the campaign invoice in
// campaignInvoicePdf.js is the opposite: Avyaya's bill to them, produced
// after).
//
// THE LOAD-BEARING IDEA: both output formats are rendered from ONE ordered
// field list (submissionSections). A PDF and a spreadsheet that are built by
// two separate pieces of code drift the moment either is edited — one gains a
// field, the other silently doesn't, and the merchant's two copies of the
// same legal-ish record disagree. Here, adding a row to submissionSections
// adds it to both, or to neither.
// =============================================================================
const PDFDocument = require("pdfkit");
const { registerBrandFonts } = require("./pdfFonts");

const NAVY = "#142850";
const TEAL = "#0F766E";
const GRAY = "#6B7280";
const INK = "#111827";
const LINE = "#E5E7EB";

function money(symbol, n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return symbol + v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtStamp(ms) {
  if (!ms) return "—";
  // Explicit timezone label: this is the record of when the merchant
  // committed to a campaign, so an ambiguous local time is not good enough.
  return new Date(ms).toLocaleString("en-CA", {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZoneName: "short",
  });
}

/**
 * The single source of truth for what a submission record contains, in the
 * order it should be presented. Both renderers below walk exactly this.
 * Returns [{ title, rows: [[label, value], …] }, …] plus a `criteria` table.
 */
function submissionSections(sub) {
  const symbol = sub.currencySymbol || (sub.country === "India" ? "₹" : "$");
  const filters = sub.filters || null;

  const sections = [
    {
      title: "Submission",
      rows: [
        ["Reference", sub.reference || "—"],
        ["Submitted at", fmtStamp(sub.submittedAtMs)],
        ["Status", sub.status === "paid" ? "Paid" : "Submitted — awaiting payment"],
      ],
    },
    {
      title: "Merchant",
      rows: [
        ["Business", sub.businessName || "—"],
        ["Category", sub.category || "—"],
        ["Country", sub.country || "—"],
        ["City", sub.city || "—"],
        ["Address", sub.address || "—"],
        ["Account email", sub.merchantEmail || "—"],
      ],
    },
    {
      title: "Campaign",
      rows: [
        ["Plan", sub.tierLabel || sub.tier || "—"],
        ["Build mode", sub.mode === "simple" ? "One campaign per parameter" : "Single combined audience"],
        ["Duration", sub.duration || "—"],
        ["Offer valid until", sub.validUntil || "Default (14 days from launch)"],
        ["Targeting area", filters && filters.area ? filters.area : "Not restricted"],
        ["Lookback range", filters && filters.range ? filters.range : "Not restricted"],
        ["Parameters selected", String((sub.criteria || []).length)],
        ["Discount codes", (sub.discountCodes || []).join(", ") || "—"],
      ],
    },
    {
      title: "Price",
      rows: [
        ["Amount", sub.priceDisplay || "—"],
        ["Pricing model", sub.pricing && sub.pricing.mode === "simple" ? "Per parameter, per week" : "Plan rate"],
        ["Billing weeks", sub.pricing && sub.pricing.weeks ? String(sub.pricing.weeks) : "—"],
      ],
    },
  ];

  if (Array.isArray(sub.manualCriteria) && sub.manualCriteria.length) {
    sections.push({
      title: "Custom requests",
      rows: sub.manualCriteria.map((m, i) => [`Request ${i + 1}`, String(m)]),
    });
  }

  const criteria = (sub.criteria || []).map((c, i) => ({
    n: i + 1,
    label: c.label || "—",
    value: c.value == null ? "—" : String(c.value),
    discount: c.discountPct != null ? `${c.discountPct}%` : "—",
    cap: c.capAmount ? money(symbol, c.capAmount) : "—",
    code: c.code || (sub.discountCodes || [])[i] || "—",
  }));

  return { sections, criteria, symbol };
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------
function buildCampaignSubmissionPdfBuffer(sub) {
  return new Promise((resolve, reject) => {
    const { sections, criteria } = submissionSections(sub);
    // A4 with real page breaks rather than the fixed-height receipt format —
    // a submission can carry 20+ parameters and must never clip.
    const doc = new PDFDocument({ size: "A4", margin: 0 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    registerBrandFonts(doc);

    const PW = doc.page.width;
    const L = 48;
    const R = PW - 48;
    const BOTTOM = doc.page.height - 64;
    let y = 0;

    function header() {
      doc.rect(0, 0, PW, 104).fill(NAVY);
      doc.fillColor("#FFFFFF").font("Body-Bold").fontSize(19).text("Avyaya", L, 30);
      doc.font("Body").fontSize(10).fillColor("#C7D2E4").text("Campaign submission record", L, 55);
      doc.font("Body").fontSize(8.5).fillColor("#9AAAC4")
        .text(sub.reference || "", L, 74, { width: R - L });
      doc.font("Body").fontSize(8.5).fillColor("#9AAAC4")
        .text(fmtStamp(sub.submittedAtMs), L, 74, { width: R - L, align: "right" });
      y = 134;
    }

    function ensure(space) {
      if (y + space <= BOTTOM) return;
      doc.addPage();
      y = 56;
    }

    function sectionTitle(text) {
      ensure(34);
      doc.font("Body-Bold").fontSize(8).fillColor(TEAL)
        .text(String(text).toUpperCase(), L, y, { characterSpacing: 1.1 });
      y += 14;
      doc.moveTo(L, y).lineTo(R, y).lineWidth(1).strokeColor(LINE).stroke();
      y += 10;
    }

    function kv(label, value) {
      const valW = R - L - 150;
      const h = Math.max(doc.font("Body").fontSize(9.5).heightOfString(String(value), { width: valW }), 12);
      ensure(h + 6);
      doc.font("Body").fontSize(9.5).fillColor(GRAY).text(label, L, y, { width: 145 });
      doc.font("Body-Bold").fontSize(9.5).fillColor(INK).text(String(value), L + 150, y, { width: valW });
      y += h + 6;
    }

    header();

    for (const s of sections) {
      sectionTitle(s.title);
      for (const [label, value] of s.rows) kv(label, value);
      y += 10;
    }

    // ---- parameters table ----
    sectionTitle(`Parameters (${criteria.length})`);
    // Widths sum to the printable width (A4 minus the 48pt margins = 499pt).
    // "Disc %" rather than "Discount": at 7.5pt with letter-spacing the longer
    // word overflowed its column and rendered as "DISCOUN / T" across two
    // lines, and the code column was too narrow to hold a full discount code
    // on one line.
    const cols = [
      { k: "n", w: 20, label: "#" },
      { k: "label", w: 198, label: "Parameter" },
      { k: "value", w: 88, label: "Value" },
      { k: "discount", w: 52, label: "Disc %" },
      { k: "cap", w: 44, label: "Cap" },
      { k: "code", w: 97, label: "Code" },
    ];
    function tableHead() {
      ensure(22);
      let x = L;
      doc.font("Body-Bold").fontSize(7.5).fillColor(GRAY);
      for (const c of cols) {
        doc.text(c.label.toUpperCase(), x, y, { width: c.w, characterSpacing: 0.6 });
        x += c.w;
      }
      y += 13;
      doc.moveTo(L, y).lineTo(R, y).lineWidth(0.7).strokeColor(LINE).stroke();
      y += 7;
    }
    tableHead();
    if (!criteria.length) {
      doc.font("Body").fontSize(9).fillColor(GRAY).text("No parameters recorded.", L, y);
      y += 16;
    }
    for (const row of criteria) {
      const labelH = doc.font("Body").fontSize(8.5).heightOfString(row.label, { width: cols[1].w - 8 });
      const h = Math.max(labelH, 11);
      if (y + h + 8 > BOTTOM) { doc.addPage(); y = 56; tableHead(); }
      let x = L;
      for (const c of cols) {
        doc.font(c.k === "label" ? "Body-Bold" : "Body").fontSize(8.5)
          .fillColor(c.k === "label" ? INK : GRAY)
          .text(String(row[c.k]), x, y, { width: c.w - 8 });
        x += c.w;
      }
      y += h + 7;
      doc.moveTo(L, y - 3).lineTo(R, y - 3).lineWidth(0.5).strokeColor("#F3F4F6").stroke();
    }

    // ---- footer note ----
    ensure(52);
    y += 10;
    doc.font("Body").fontSize(8).fillColor(GRAY).text(
      "This is a record of what was submitted, not a receipt. No payment has been taken at the time this " +
        "record is generated, and no offers are sent to customers until payment completes. A separate campaign " +
        "invoice is issued once payment succeeds.",
      L, y, { width: R - L, lineGap: 2 }
    );

    doc.end();
  });
}

// ---------------------------------------------------------------------------
// CSV (opens directly in Excel / Numbers / Sheets)
// ---------------------------------------------------------------------------
function csvCell(v) {
  const s = v == null ? "" : String(v);
  // Quote whenever the value could otherwise break the row, and double any
  // embedded quote — the standard CSV escape.
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCampaignSubmissionCsv(sub) {
  const { sections, criteria } = submissionSections(sub);
  const lines = [];
  for (const s of sections) {
    lines.push(csvCell(s.title));
    for (const [label, value] of s.rows) lines.push(`${csvCell(label)},${csvCell(value)}`);
    lines.push("");
  }
  lines.push(csvCell(`Parameters (${criteria.length})`));
  lines.push(["#", "Parameter", "Value", "Discount", "Cap", "Code"].map(csvCell).join(","));
  for (const r of criteria) {
    lines.push([r.n, r.label, r.value, r.discount, r.cap, r.code].map(csvCell).join(","));
  }
  lines.push("");
  lines.push(csvCell("This is a record of what was submitted, not a receipt. No payment has been taken."));
  // BOM so Excel reads the UTF-8 (₹, —, accented merchant names) correctly
  // instead of mojibake — without it Excel assumes the local ANSI codepage.
  return "﻿" + lines.join("\r\n");
}

module.exports = { buildCampaignSubmissionPdfBuffer, buildCampaignSubmissionCsv, submissionSections };
