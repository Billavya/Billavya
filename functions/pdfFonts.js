// Shared font loader for every pdfkit-based PDF this project generates
// (receiptPdf.js, campaignInvoicePdf.js). pdfkit's built-in "Helvetica"
// standard font only supports WinAnsi/Latin-1 — it CANNOT render ₹ (U+20B9)
// at all: confirmed directly (rendered as a totally blank line, not even a
// tofu box) before this file existed. DejaVu Sans is a single, complete,
// non-variable TTF with broad Unicode coverage (confirmed: renders ₹
// alongside plain ASCII correctly in the same string) — Google's own Noto
// Sans web subsets were tried first and rejected because Google splits
// "latin" (ASCII) and "latin-ext" (accented Latin, where ₹ apparently
// landed) into separate files, and pdfkit has no cross-font glyph fallback
// within one string.
//
// pdfkit subsets embedded fonts to only the glyphs actually used in each
// document, so bundling these ~700KB TTFs costs nothing per generated PDF
// (confirmed: a real invoice stayed a few KB) — only a one-time increase to
// the deployed function bundle.
const path = require("path");

function registerBrandFonts(doc) {
  doc.registerFont("Body", path.join(__dirname, "assets/DejaVuSans.ttf"));
  doc.registerFont("Body-Bold", path.join(__dirname, "assets/DejaVuSans-Bold.ttf"));
}

module.exports = { registerBrandFonts };
