// =============================================================================
// Campaign purchase invoice — Avyaya's own invoice TO the merchant for a
// campaign they just bought on merchant-portal (the opposite direction from
// receiptPdf.js, which is the merchant's invoice to ITS customer). Built
// entirely from the campaign summary the portal already has in hand right
// after Stripe confirms payment — not from the `campaigns` Firestore doc,
// since that's only written by stripeWebhook asynchronously and may not
// exist yet by the time the merchant is back on this page (the portal's own
// client-side code already works around this same race for audience-query/
// offer-push, via sessionStorage — see runCampaignExecution in
// merchant-portal/index.html). Generated on demand only, same zero-storage-
// cost approach as receiptPdf.js.
// =============================================================================
const PDFDocument = require("pdfkit");
const { registerBrandFonts } = require("./pdfFonts");

const NAVY = "#1E293B";
const BLUE = "#2563EB";
const GREEN = "#16A34A";
const GRAY = "#6B7280";
const INK = "#111827";
const W = 360;
const BODY_SIZE = 9;

function buildCampaignInvoicePdfBuffer(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [W, 760], margin: 0 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    registerBrandFonts(doc);

    const criteria = Array.isArray(data.criteria) ? data.criteria : [];
    const L = 24,
      R = W - 24;
    let y = 0;

    // ---- Header ----
    const headerH = 90;
    doc.rect(0, 0, W, headerH).fill(NAVY);
    doc.fillColor("#FFFFFF").font("Body-Bold").fontSize(16).text("Avyaya", L, 22);
    doc.font("Body").fontSize(9).fillColor("#D1D5DB").text("Campaign Invoice", L, 44);
    doc.font("Body").fontSize(8).fillColor("#9CA3AF").text(
      new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      L,
      60
    );
    y = headerH + 18;

    function dashedLine() {
      doc.moveTo(L, y).lineTo(R, y).dash(2, { space: 2 }).strokeColor("#D1D5DB").stroke();
      doc.undash();
      y += 10;
    }
    function kv(label, value) {
      doc.font("Body").fontSize(BODY_SIZE).fillColor(GRAY).text(label, L, y, { width: 110 });
      doc.font("Body-Bold").fontSize(BODY_SIZE).fillColor(INK).text(value || "—", L + 110, y, { width: R - L - 110 });
      y += 14;
    }

    doc.font("Body-Bold").fontSize(12).fillColor(INK).text(data.businessName || "Merchant", L, y);
    y += 16;
    kv("Email", data.merchantEmail);
    kv("Category", [data.category, data.country].filter(Boolean).join(" · "));
    y += 4;
    dashedLine();

    doc.font("Body-Bold").fontSize(BODY_SIZE + 1).fillColor(BLUE).text("Package purchased", L, y);
    y += 14;
    kv("Tier", data.tierLabel);
    kv("Duration", data.duration);
    kv("Discount code", data.discountCode);
    y += 4;
    doc.font("Body-Bold").fontSize(BODY_SIZE + 2).fillColor(BLUE).text("Amount paid", L, y, { width: 150 });
    doc.text(data.priceDisplay || "—", L, y, { width: R - L, align: "right" });
    y += 18;
    dashedLine();

    doc.font("Body-Bold").fontSize(BODY_SIZE + 1).fillColor(INK).text("Parameters in this campaign", L, y);
    y += 14;
    for (const c of criteria) {
      doc.font("Body-Bold").fontSize(BODY_SIZE).fillColor(INK).text(c.label || "", L, y, { width: R - L });
      y += 12;
      const detail = [c.value, c.discountPct != null ? `${c.discountPct}% off` : null, c.capAmount ? `capped at ${c.capAmount}` : null]
        .filter(Boolean)
        .join(" · ");
      doc.font("Body").fontSize(BODY_SIZE - 1).fillColor(GRAY).text(detail, L, y, { width: R - L });
      y += 14;
    }
    y += 4;
    dashedLine();

    if (data.totalCustomers != null || data.totalOffersPushed != null) {
      doc.font("Body-Bold").fontSize(BODY_SIZE + 1).fillColor(INK).text("Results", L, y);
      y += 14;
      if (data.totalCustomers != null) kv("Customers evaluated", String(data.totalCustomers));
      if (data.totalOffersPushed != null) kv("Offers pushed", String(data.totalOffersPushed));
      y += 4;
      dashedLine();
    }

    doc.font("Body").fontSize(7).fillColor(GRAY).text(
      "This invoice confirms your campaign purchase on Avyaya's merchant portal. Reassembled from your own campaign data — not a stored document.",
      L,
      y,
      { width: R - L, align: "center" }
    );
    y += 20;
    doc.circle(W / 2, y, 2.5).fill(GREEN);

    doc.end();
  });
}

module.exports = { buildCampaignInvoicePdfBuffer };
