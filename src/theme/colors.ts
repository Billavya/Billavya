export const colors = {
  // California Orange & Oxblood — chosen after reviewing Rose & Slate,
  // Cobalt & Papaya, Oxblood & Brass, and the full 12-palette set. gold/
  // amber/danger below are intentionally untouched: they already matched
  // the psychology-driven colors (red attention cue, gold reward reveal)
  // discussed before this rebrand, just not yet wired to the right spots —
  // see AppHeader.tsx and OfferDetailModal.tsx for those two fixes.
  navy: "#4A1620",
  navy2: "#722C1F",
  teal: "#FF7A1A",
  tealDark: "#C2560F",
  tealTint: "#FFE4D1",
  appBg: "#F7F4EF",
  card: "#FFFFFF",
  line: "#DBD0D2",
  muted: "#7A5560",
  muted2: "#C3B2B7",
  amberTint: "#FEF3C7",
  amberTint2: "#FFFBEB",
  amberLine: "#FDE68A",
  amberInk: "#92400E",
  amberInk2: "#B45309",
  green: "#22C55E",
  /** Same gold already used for Home's "THIS MONTH" label — reused here as
   *  the folder-icon glyph color on its navy chip, so this app has exactly
   *  one named "gold" instead of the literal getting re-typed per use. */
  gold: "#FDB515",
  // Error/destructive palette — previously these exact same shades were
  // pasted as raw hex literals into 8+ files (form-field errors, the logout
  // row, transferred-invoice styling, the Transfer confirmation screen) with
  // no single name tying them together. Named here the same way the amber
  // family above already was, so there's one place to change "what red
  // means" in this app instead of a find-and-replace across the codebase.
  dangerTint: "#FEF2F2",
  dangerLine: "#FECACA",
  dangerSoft: "#FCA5A5",
  danger: "#DC2626",
  dangerBright: "#EF4444",
  dangerDark: "#B91C1C",
  dangerDeep: "#7F1D1D",
} as const;
