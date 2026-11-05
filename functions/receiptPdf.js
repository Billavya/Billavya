// =============================================================================
// The "digitized invoice" base template — one stencil, reused for every
// merchant regardless of which POS the sale came from (Clover, Square,
// Stripe, manual entry, whatever comes next). It is built ENTIRELY from the
// same normalized invoice JSON every invoice already has in Firestore — no
// dependency on a POS's own hosted receipt page (which only Clover happens
// to have, and which isn't guaranteed to stay live for years — see the
// conversation that led here). Generated on demand, when a customer actually
// taps Download/Share on an invoice — never pre-generated or stored, so
// there is zero ongoing storage cost from this feature; only the handful of
// milliseconds of Cloud Functions compute spent per download.
//
// Visually modeled on Clover's own hosted receipt layout (dark header, blue
// contact links, big "Total paid" figure, dashed tear-lines, Payment
// section) since that's the most legible, most-tested layout already in
// front of real users — but deliberately NOT Clover's actual logo/mark,
// since that's their trademark and this template has to represent every
// POS, not just Clover.
// =============================================================================
const PDFDocument = require("pdfkit");

const NAVY = "#1E293B";
const BLUE = "#2563EB";
const GREEN = "#16A34A";
const GRAY = "#6B7280";
const INK = "#111827";
const W = 320;
// Every other number on the page (item prices, subtotal, order total) is
// set at this size — "Total paid" is deliberately only 2pt larger than
// this, not a jump to a large display size, so it stays proportioned no
// matter how short or long the total string is.
const BODY_SIZE = 9;

// Same rule as formatTaxIdLine() in InvoiceDetailModal.tsx: a Clover-sourced
// tax id already carries its own label (e.g. "HST # 123456782 RT0001");
// a bare India GSTIN does not, so it gets "GSTIN " prefixed. Kept in sync by
// hand — see that file if this rule ever changes.
function formatTaxIdLine(gstin) {
  return /^(GST|HST|VAT|PST|QST)\b/i.test(gstin) ? gstin : `GSTIN ${gstin}`;
}

function money(n) {
  return `$${(Number(n) || 0).toFixed(2)}`;
}

/**
 * Renders one invoice (the same shape stored in the `invoices` collection —
 * see the `record` object in receiveInvoice, functions/index.js) into a PDF
 * matching the base stencil. Returns a Buffer.
 */
function buildReceiptPdfBuffer(invoice) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [W, 760], margin: 0 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const items = Array.isArray(invoice.items) ? invoice.items : [];
    const headerLines = [invoice.merchantAddress, invoice.gstin ? formatTaxIdLine(invoice.gstin) : null]
      .filter(Boolean)
      .join("   ");

    // ---- Header block ----
    const headerH = 130;
    doc.rect(0, 0, W, headerH).fill(NAVY);
    doc.circle(W / 2, 32, 18).fill("#FFFFFF");
    doc.rect(W / 2 - 9, 25, 18, 13).fill(BLUE);
    doc.polygon([W / 2 - 11, 25], [W / 2 + 11, 25], [W / 2 + 7, 18], [W / 2 - 7, 18]).fill(BLUE);

    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(13).text(invoice.merchant || "", 10, 60, { width: W - 20, align: "center" });
    if (headerLines) {
      doc.font("Helvetica-Oblique").fontSize(7.5).fillColor("#D1D5DB");
      doc.text(headerLines, 16, 80, { width: W - 32, align: "center" });
    }

    // ---- Body ----
    let y = headerH + 14;
    const L = 20,
      R = W - 20;

    function dashedLine() {
      doc.moveTo(L, y).lineTo(R, y).dash(2, { space: 2 }).strokeColor("#D1D5DB").stroke();
      doc.undash();
      y += 10;
    }

    if (invoice.invoiceNo) {
      doc.font("Helvetica").fontSize(8).fillColor(GRAY).text(`Invoice ${invoice.invoiceNo}`, L, y, { width: R - L, align: "center" });
      y += 12;
    }
    const orderLine = [invoice.table, invoice.orderType || "Dine-in"].filter(Boolean).join(" · ");
    doc.text(orderLine, L, y, { width: R - L, align: "center" });
    y += 12;
    doc.text(invoice.date || "", L, y, { width: R - L, align: "center" });
    y += 14;
    dashedLine();

    doc.fillColor(INK).font("Helvetica").fontSize(BODY_SIZE);
    for (const it of items) {
      const qty = it.qty && it.qty !== 1 ? ` × ${it.qty}` : "";
      doc.text(`${it.name || "Item"}${qty}`, L, y, { width: 190 });
      doc.text(money(it.amount != null ? it.amount : (it.unit || 0) * (it.qty || 1)), L, y, { width: R - L, align: "right" });
      y += 15;
    }
    y += 4;
    dashedLine();

    function row(label, value, opts = {}) {
      doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(BODY_SIZE).fillColor(opts.color || INK);
      doc.text(label, L, y, { width: 190 });
      doc.text(value, L, y, { width: R - L, align: "right" });
      y += 14;
    }
    row("Subtotal", money(invoice.subtotal));
    if (invoice.tax) row("Total Taxes", money(invoice.tax), { color: GRAY });
    if (invoice.discount) {
      const pct = invoice.discountPct ? ` (${invoice.discountPct}%)` : "";
      if (invoice.discountCode) {
        doc.font("Helvetica").fontSize(7.5).fillColor(GREEN).text(`Discount${pct} [${invoice.discountCode}]`, L, y, { width: R - L });
        y += 12;
      }
      row(invoice.discountCode ? "" : `Discount${pct}`, `-${money(invoice.discount)}`, { color: GREEN });
    }
    row("Order total", money(invoice.total), { bold: true });
    y += 6;

    // ---- "Total paid" ----
    // Sized relative to the body text (BODY_SIZE + 2), not a fixed large
    // display size — a fixed huge digit size looked fine for a 2-digit
    // dollar amount but visually broke for anything shorter/longer (e.g. a
    // lone "6" floating oversized next to "78"). Right-aligned as one
    // string like every other row above it, just bigger and blue, so it
    // scales sensibly with any total.
    doc.font("Helvetica-Bold").fontSize(BODY_SIZE + 2).fillColor(BLUE);
    doc.text("Total paid", L, y, { width: 150 });
    doc.text(money(invoice.total), L, y, { width: R - L, align: "right" });
    y += 18;
    dashedLine();

    if (invoice.cashier) {
      doc.font("Helvetica").fontSize(8).fillColor("#374151").text(`Order Employee: ${invoice.cashier}`, L, y, { width: R - L, align: "center" });
      y += 12;
    }
    if (invoice.avyayaId) {
      doc.font("Helvetica-Bold").fontSize(8).fillColor(INK).text(`"${invoice.avyayaId}"`, L, y, { width: R - L, align: "center" });
      y += 14;
    }
    dashedLine();

    doc.font("Helvetica").fontSize(7).fillColor(GRAY).text("Digitized by Avyaya — reassembled from the merchant's own invoice data", L, y, { width: R - L, align: "center" });
    y += 14;
    doc.circle(W / 2, y, 2.5).fill(GREEN);

    doc.end();
  });
}

module.exports = { buildReceiptPdfBuffer, formatTaxIdLine };
