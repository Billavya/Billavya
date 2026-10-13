/**
 * Static scheduling config for the Peak-Hours/Festival Spotlight feature —
 * WHEN a spotlight can appear. WHO sponsors it (merchant name, offer text)
 * lives in Firestore (src/services/spotlightSponsors.ts) so it can change
 * without an app update, same split as every other offer/campaign in the app.
 */

export interface DaypartWindow {
  key: "lunch" | "dinner";
  label: string;
  startMin: number; // minutes since local midnight, inclusive
  endMin: number; // inclusive
}

/** Lunch 11:00 AM–1:00 PM, dinner 6:00–9:00 PM. */
export const DAYPART_WINDOWS: DaypartWindow[] = [
  { key: "lunch", label: "Lunch", startMin: 11 * 60, endMin: 13 * 60 },
  { key: "dinner", label: "Dinner", startMin: 18 * 60, endMin: 21 * 60 },
];

/** `minutesSinceMidnight` must already be resolved in the customer's selected city/country's time zone — see src/utils/timezone.ts's nowInTimeZone, not the device's own local clock. */
export function activeDaypartWindow(minutesSinceMidnight: number): DaypartWindow | null {
  return DAYPART_WINDOWS.find((w) => minutesSinceMidnight >= w.startMin && minutesSinceMidnight <= w.endMin) ?? null;
}

export interface HinduFestival {
  name: string;
  /** Local calendar date, "YYYY-MM-DD". */
  date: string;
}

/**
 * Major pan-India Hindu festivals, 2026. Lunar-calendar dates shift every
 * year — this list needs a fresh pass (not just a date shift) whenever the
 * app rolls into a new year.
 */
export const HINDU_FESTIVALS_2026: HinduFestival[] = [
  { name: "Makar Sankranti", date: "2026-01-14" },
  { name: "Vasant Panchami", date: "2026-01-23" },
  { name: "Maha Shivratri", date: "2026-02-15" },
  { name: "Holi", date: "2026-03-04" },
  { name: "Ugadi / Gudi Padwa", date: "2026-03-19" },
  { name: "Ram Navami", date: "2026-03-26" },
  { name: "Hanuman Jayanti", date: "2026-04-02" },
  { name: "Guru Purnima", date: "2026-07-29" },
  { name: "Raksha Bandhan", date: "2026-08-28" },
  { name: "Janmashtami", date: "2026-09-04" },
  { name: "Ganesh Chaturthi", date: "2026-09-14" },
  { name: "Navratri Begins", date: "2026-10-11" },
  { name: "Dussehra", date: "2026-10-20" },
  { name: "Karva Chauth", date: "2026-10-29" },
  { name: "Diwali", date: "2026-11-08" },
  { name: "Chhath Puja", date: "2026-11-15" },
];

/** The Religion folder highlights for the festival day plus this many days before it. */
export const FESTIVAL_WINDOW_DAYS = 3;

export interface ActiveFestivalWindow {
  festival: HinduFestival;
  /** 0-based position within the window, chronological (0 = first day shown, FESTIVAL_WINDOW_DAYS-1 = festival day itself). */
  dayIndex: number;
  /** 0 = today is the festival day itself. */
  daysUntil: number;
}

/** "YYYY-MM-DD" for a date, in the DEVICE's own local time — kept only for callers with no timezone-aware date to pass (see src/utils/timezone.ts's nowInTimeZone for the timezone-correct version Spotlight itself uses). */
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** `todayKey` ("YYYY-MM-DD") must already be resolved in the customer's selected city/country's time zone — see src/utils/timezone.ts's nowInTimeZone. */
export function activeFestivalWindow(
  todayKey: string,
  festivals: HinduFestival[] = HINDU_FESTIVALS_2026
): ActiveFestivalWindow | null {
  const [ty, tm, td] = todayKey.split("-").map(Number);
  const today = Date.UTC(ty, tm - 1, td);
  for (const festival of festivals) {
    const [y, m, d] = festival.date.split("-").map(Number);
    const festivalDate = Date.UTC(y, m - 1, d);
    const daysUntil = Math.round((festivalDate - today) / 86400000);
    if (daysUntil >= 0 && daysUntil < FESTIVAL_WINDOW_DAYS) {
      return { festival, dayIndex: FESTIVAL_WINDOW_DAYS - 1 - daysUntil, daysUntil };
    }
  }
  return null;
}
