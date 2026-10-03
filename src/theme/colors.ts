export const colors = {
  navy: "#0B2545",
  navy2: "#13293D",
  teal: "#00C2A8",
  tealDark: "#038C7F",
  tealTint: "#E3F7F3",
  appBg: "#F3F6F8",
  card: "#FFFFFF",
  line: "#E5EBED",
  muted: "#5B6B7C",
  muted2: "#8B98A6",
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
