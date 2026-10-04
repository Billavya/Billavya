import { CountryCode } from "@/config/locale";

/**
 * Maps a free-text merchant address (as typed into the POS) to one of the
 * cities the Search screen filters by. "Bangalore" and "Bengaluru" both
 * resolve to the same canonical city, and so on for common aliases — kept
 * as one merged table across both countries (not gated by the currently
 * selected country) since an invoice's own address always names a real
 * city regardless of which country the viewer has their profile set to.
 */
const CITY_ALIASES: Record<string, string> = {
  bengaluru: "Bengaluru",
  bangalore: "Bengaluru",
  mumbai: "Mumbai",
  bombay: "Mumbai",
  "new delhi": "Delhi",
  delhi: "Delhi",
  hyderabad: "Hyderabad",
  chennai: "Chennai",
  madras: "Chennai",
  pune: "Pune",
  toronto: "Toronto",
  gta: "Toronto",
  vancouver: "Vancouver",
  calgary: "Calgary",
  ottawa: "Ottawa",
  montreal: "Montreal",
  edmonton: "Edmonton",
};

/**
 * The cities the Search screen's Location filter cycles through — keyed by
 * country so switching the Country/Region row in Profile also changes
 * which cities show up here, instead of always showing one country's list
 * regardless of which market the account is actually set to.
 */
const CITY_LISTS: Record<CountryCode, string[]> = {
  India: ["Bengaluru", "Mumbai", "Delhi", "Hyderabad", "Chennai", "Pune"],
  Canada: ["Toronto", "Vancouver", "Calgary", "Ottawa", "Montreal", "Edmonton"],
};

/** Invoices with no resolvable address fall back to this — the current country's home city. */
const DEFAULT_LOCATIONS: Record<CountryCode, string> = {
  India: "Bengaluru",
  Canada: "Toronto",
};

export function getCityList(country: CountryCode): string[] {
  return CITY_LISTS[country];
}

export function getDefaultLocation(country: CountryCode): string {
  return DEFAULT_LOCATIONS[country];
}

/** Reads a free-text address and returns the matching city, or null if none matched. */
export function inferLocation(address?: string | null): string | null {
  if (!address) return null;
  const lower = address.toLowerCase();
  for (const key of Object.keys(CITY_ALIASES)) {
    if (lower.includes(key)) return CITY_ALIASES[key];
  }
  return null;
}
