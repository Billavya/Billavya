/**
 * Maps a free-text merchant address (as typed into the POS) to one of the
 * cities the Search screen already filters by. "Bangalore" and "Bengaluru"
 * both resolve to the same canonical city, and so on for common aliases.
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
};

/** The cities the Search screen's Location filter cycles through. */
export const CITY_LIST = ["Bengaluru", "Mumbai", "Delhi", "Hyderabad", "Chennai", "Pune"];

/** Invoices with no resolvable address fall back to this — your account's home city. */
export const DEFAULT_LOCATION = "Bengaluru";

/** Reads a free-text address and returns the matching city, or null if none matched. */
export function inferLocation(address?: string | null): string | null {
  if (!address) return null;
  const lower = address.toLowerCase();
  for (const key of Object.keys(CITY_ALIASES)) {
    if (lower.includes(key)) return CITY_ALIASES[key];
  }
  return null;
}
