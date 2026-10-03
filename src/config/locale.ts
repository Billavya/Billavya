/**
 * Single source of truth for anything market/locale-specific — currency
 * symbol, tax label/rate, and the country this build targets.
 *
 * Before this file existed, the currency symbol ("₹") and tax terminology
 * were pasted directly into whichever component needed them — HomeScreen,
 * InvoiceDetailModal, offerEligibility.ts, and others each had their own
 * literal "₹". That's exactly what made the Canadian demo fork (see
 * avyaya-ca-demo) error-prone to build: each one had to be found and fixed
 * by hand, one file at a time, and it still took multiple passes to catch
 * them all (the Search screen's "India" label and the city list were missed
 * on the first pass). Adapting this app for a new market should mean
 * editing this one file, not grepping the whole codebase for a symbol.
 */
export const LOCALE = {
  country: "India",
  currencySymbol: "₹",
  currencyCode: "INR",
  /** What the POS checkout screens and invoices call sales tax here. */
  taxLabel: "CGST + SGST",
  taxRatePercent: 5,
  /** Passed to Number.prototype.toLocaleString for digit grouping (lakhs/crores here). */
  numberLocale: "en-IN",
} as const;
