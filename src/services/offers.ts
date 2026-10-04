// From the standalone @firebase/firestore package, not the "firebase"
// wrapper's own bundled copy — see the long comment in src/config/firebase.ts
// for why mixing the two is the root cause of a real, confirmed launch crash.
import { collection, doc, getDocs, onSnapshot, query, updateDoc, where } from "@firebase/firestore";
import { db, isFirebaseConfigured } from "@/config/firebase";

/** An offer a merchant's campaign has pushed to a specific Avyaya ID. */
export interface LiveOffer {
  id: string;
  avyayaId: string;
  /** Which country's campaign pushed this offer — "India" or "Canada".
   *  Absent on offers written before this field existed; treated as
   *  "India" everywhere it's read (see effectiveCountry in invoices.ts —
   *  same convention, same reason). */
  country?: string;
  folder: string;
  pct: string;
  merchant: string;
  desc: string;
  exp: string;
  campaignTier?: string;
  criterion?: string;
  /**
   * The campaign's "Capping Amount" (rupees) — a ceiling on the actual
   * discount a percent-based offer pays out, e.g. a 10% offer with
   * capAmount 100 never discounts more than ₹100 even on a large bill. See
   * offerEligibility.ts and the matching offerValue() in pos-web/
   * pos-web-grocery for where this is actually enforced.
   */
  capAmount?: number;
  createdAtMs: number;
  /** Set once the customer has activated/availed this offer from its detail sheet. */
  activated?: boolean;
  activatedAtMs?: number | null;
  /**
   * Set by the merchant's POS the moment this offer is actually applied to a
   * bill — the offer is spent at that point. Once set, it's terminal: this
   * offer can never be re-activated or re-applied again, even though
   * `activated` stays true as a record that it once was. One offer, one use.
   */
  redeemedAtMs?: number | null;
  /** Set by a merchant campaign — once Date.now() passes this, the offer reads as expired, same as the built-in sample "expired" offers. */
  expiresAtMs?: number | null;
}

/** An offer with no `country` tag predates this field — always India. */
function effectiveCountry(x: { country?: string }): string {
  return x.country || "India";
}

/**
 * Live-subscribe to offers pushed to this Avyaya ID for one folder, in the
 * given country — mirrors subscribeInvoices (see the country-leak note
 * there for why this filter exists).
 */
export function subscribeOffers(
  avyayaId: string,
  folder: string,
  country: string,
  onChange: (offers: LiveOffer[]) => void
): () => void {
  if (!isFirebaseConfigured || !db || !avyayaId) {
    onChange([]);
    return () => {};
  }
  const q = query(collection(db, "offers"), where("avyayaId", "==", avyayaId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<LiveOffer, "id">) }))
        .filter((x) => x.folder === folder && effectiveCountry(x) === country)
        .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
      onChange(list);
    },
    () => onChange([])
  );
}

/**
 * One-time fetch of every offer pushed to this Avyaya ID in the given
 * country — used to check whether an invoice already in a folder qualifies
 * for an activated offer (see src/utils/offerEligibility.ts), not for live
 * display, so a plain fetch is enough; no need for an onSnapshot
 * subscription here.
 */
export async function getOffersForCustomer(avyayaId: string, country: string): Promise<LiveOffer[]> {
  if (!isFirebaseConfigured || !db || !avyayaId) return [];
  try {
    const snap = await getDocs(query(collection(db, "offers"), where("avyayaId", "==", avyayaId)));
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<LiveOffer, "id">) }))
      .filter((x) => effectiveCountry(x) === country);
  } catch {
    return [];
  }
}

/** Activates (or undoes activating) an offer from its detail sheet. */
export async function setOfferActivated(offerId: string, activated: boolean): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  await updateDoc(doc(db, "offers", offerId), {
    activated,
    activatedAtMs: activated ? Date.now() : null,
  });
}
