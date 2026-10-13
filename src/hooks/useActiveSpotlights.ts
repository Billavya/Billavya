import { useEffect, useMemo, useState } from "react";
import { useLocaleCountry } from "@/config/locale";
import { FolderIconKey } from "@/data/folders";
import { activeDaypartWindow, activeFestivalWindow, localDateKey } from "@/data/spotlightConfig";
import { SpotlightSponsor, subscribeSpotlightSponsors } from "@/services/spotlightSponsors";

export interface ActiveSpotlight {
  /** Stable per-track id (e.g. "food-lunch", "religion-festival") — distinguishes which window/track a spotlight came from, not used for any once-per-day gating anymore (the offer stays up for the whole active window). */
  trackKey: string;
  category: FolderIconKey;
  merchantName: string;
  merchantAddress?: string;
  locationMapUrl?: string;
  offerLine: string;
  badgeLabel: "SPOTLIGHT" | "FESTIVAL";
  bannerTitle: string;
}

function resolveActiveSpotlights(sponsors: SpotlightSponsor[], minutesSinceMidnight: number, todayKey: string): ActiveSpotlight[] {
  const results: ActiveSpotlight[] = [];

  const win = activeDaypartWindow(minutesSinceMidnight);
  if (win) {
    const sponsor = sponsors.find((s) => s.kind === "daypart" && s.category === "Food" && s.window === win.key);
    if (sponsor) {
      results.push({
        trackKey: `food-${win.key}`,
        category: "Food",
        merchantName: sponsor.merchantName,
        merchantAddress: sponsor.merchantAddress,
        locationMapUrl: sponsor.locationMapUrl,
        offerLine: sponsor.offerLine,
        badgeLabel: "SPOTLIGHT",
        bannerTitle: `${win.label} Spotlight`,
      });
    }
  }

  const fest = activeFestivalWindow(todayKey);
  if (fest) {
    const sponsor = sponsors.find((s) => s.kind === "festival" && s.category === "Religion" && s.date === todayKey);
    if (sponsor) {
      results.push({
        trackKey: "religion-festival",
        category: "Religion",
        merchantName: sponsor.merchantName,
        merchantAddress: sponsor.merchantAddress,
        locationMapUrl: sponsor.locationMapUrl,
        offerLine: sponsor.offerLine,
        badgeLabel: "FESTIVAL",
        bannerTitle: `${fest.festival.name} Spotlight`,
      });
    }
  }

  return results;
}

/**
 * One subscription to the CURRENTLY SELECTED COUNTRY's Spotlight sponsors —
 * country only, no city. Switching country (Profile → Country/Region) is
 * enough on its own to start seeing that country's merchant campaigns; noth-
 * ing about a stale or missing city can ever block it, because city is not
 * part of this lookup at all.
 *
 * Time-of-day/date matching uses the DEVICE'S OWN LOCAL CLOCK directly
 * (whatever time zone the phone itself is currently showing) — not a
 * city-to-timezone lookup. A customer's device is assumed to already be
 * showing local time for wherever they physically are, which is what
 * "lunch" and "dinner" should mean for them, country selection aside.
 *
 * An entry in the returned array means that category's offer should be shown
 * right now, full stop — it stays up for the entire active window (no
 * once-per-day cap, no dismiss-forever state). Call once per screen (not per
 * folder tile) — callers look up the category they care about with `.find()`.
 */
export function useActiveSpotlights(): ActiveSpotlight[] {
  const country = useLocaleCountry();

  const [sponsors, setSponsors] = useState<SpotlightSponsor[]>([]);
  useEffect(() => subscribeSpotlightSponsors(country, setSponsors), [country]);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
  const dateKey = useMemo(() => localDateKey(now), [now]);

  return useMemo(() => resolveActiveSpotlights(sponsors, minutesSinceMidnight, dateKey), [sponsors, minutesSinceMidnight, dateKey]);
}
