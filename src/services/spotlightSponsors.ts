// Same standalone @firebase/firestore import as offers.ts — see the long
// comment in src/config/firebase.ts for why mixing it with the "firebase"
// wrapper's own bundled copy crashes the app.
import { collection, onSnapshot, query, where } from "@firebase/firestore";
import { db, isFirebaseConfigured } from "@/config/firebase";
import { FolderIconKey } from "@/data/folders";

/**
 * A merchant's Spotlight slot — either a recurring daypart (Food, lunch or
 * dinner) or one day of a 3-day festival window (Religion). WHEN a slot can
 * ever be eligible is static app config (src/data/spotlightConfig.ts); this
 * is just WHO currently fills it, broadcast to every customer in that
 * COUNTRY (not city — switching country alone is enough to see that
 * country's current merchant campaign) rather than pushed to one Avyaya ID
 * like a normal offer.
 */
export interface SpotlightSponsor {
  id: string;
  kind: "daypart" | "festival";
  country: string;
  category: FolderIconKey; // "Food" for daypart, "Religion" for festival
  /** daypart only */
  window?: "lunch" | "dinner";
  /** festival only — the specific day (within the 3-day window) this merchant owns, "YYYY-MM-DD" */
  date?: string;
  /** festival only */
  festivalName?: string;
  merchantName: string;
  /** Absent on illustrative festival sponsors — no real "festival goods" merchant category exists yet. */
  merchantAddress?: string;
  locationMapUrl?: string;
  offerLine: string;
  active: boolean;
  createdAtMs: number;
}

export function subscribeSpotlightSponsors(country: string, onChange: (sponsors: SpotlightSponsor[]) => void): () => void {
  if (!isFirebaseConfigured || !db || !country) {
    onChange([]);
    return () => {};
  }
  const q = query(collection(db, "spotlightSponsors"), where("country", "==", country));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<SpotlightSponsor, "id">) }))
        .filter((x) => x.active !== false);
      onChange(list);
    },
    () => onChange([])
  );
}
