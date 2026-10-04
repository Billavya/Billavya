import { useSyncExternalStore } from "react";

/**
 * Single source of truth for anything market/locale-specific — currency
 * symbol, tax label/rate, and the country this build targets.
 *
 * This used to be a fixed constant, picked once at build time (India only).
 * It's now a reactive store instead: this app and the former Canada demo
 * fork (avyaya-ca-demo) have been merged back into one codebase, and a
 * customer can pick their country at runtime via the Country/Region row in
 * Profile — everything reading `LOCALE` needs to reflect that immediately,
 * without a restart.
 *
 * `LOCALE` itself stays the exact same object reference for the life of the
 * app — `setCountry` mutates its fields in place rather than replacing it —
 * so every existing `import { LOCALE } from "@/config/locale"` across the
 * app (formatINR, offerEligibility.ts's regex, the masked total on Home,
 * the Search screen's country field, …) keeps working completely
 * unchanged. Those are plain functions, not components, so they can't use a
 * hook — they just read `LOCALE.currencySymbol` fresh each call, which is
 * always current.
 *
 * Components that need to re-render the instant the country changes (so a
 * "₹" on screen flips to "$" live, with no navigation needed) call
 * `useLocaleCountry()` below — a thin `useSyncExternalStore` subscription.
 */
export type CountryCode = "India" | "Canada";

interface LocaleShape {
  country: CountryCode;
  currencySymbol: string;
  currencyCode: string;
  /** What the POS checkout screens and invoices call sales tax here. */
  taxLabel: string;
  taxRatePercent: number;
  /** Passed to Number.prototype.toLocaleString for digit grouping. */
  numberLocale: string;
}

export const LOCALES: Record<CountryCode, LocaleShape> = {
  India: {
    country: "India",
    currencySymbol: "₹",
    currencyCode: "INR",
    taxLabel: "CGST + SGST",
    taxRatePercent: 5,
    numberLocale: "en-IN",
  },
  Canada: {
    country: "Canada",
    currencySymbol: "$",
    currencyCode: "CAD",
    taxLabel: "GST/HST",
    taxRatePercent: 5,
    numberLocale: "en-CA",
  },
};

/** This build's default, before an account has ever chosen otherwise. */
const DEFAULT_COUNTRY: CountryCode = "India";

// A real, mutable object — never reassigned, only its fields change — so
// every existing `LOCALE.xxx` read elsewhere keeps pointing at live data.
export const LOCALE: LocaleShape = { ...LOCALES[DEFAULT_COUNTRY] };

let currentCountry: CountryCode = DEFAULT_COUNTRY;
const listeners = new Set<() => void>();

export function getCountry(): CountryCode {
  return currentCountry;
}

/** Switches the active locale everywhere. Does NOT persist anything itself —
 *  callers (see useAccount's setCountry) are responsible for saving the
 *  choice to AsyncStorage/Firestore; this just updates the live, in-memory
 *  store and notifies subscribed components to re-render. */
export function setCountry(country: CountryCode): void {
  if (country === currentCountry) return;
  currentCountry = country;
  Object.assign(LOCALE, LOCALES[country]);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Re-renders the calling component whenever the country changes — call it,
 *  then just read `LOCALE.xxx` directly in render; the returned value is a
 *  convenience, not required. */
export function useLocaleCountry(): CountryCode {
  return useSyncExternalStore(subscribe, getCountry, getCountry);
}
