// From the standalone @firebase/firestore package, not the "firebase"
// wrapper's own bundled copy — see the long comment in src/config/firebase.ts
// for why mixing the two is the root cause of a real, confirmed launch crash.
import { collection, doc, onSnapshot, query, updateDoc, where } from "@firebase/firestore";
import { db, isFirebaseConfigured } from "@/config/firebase";

/** An offer a merchant's campaign has pushed to a specific Avyaya ID. */
export interface LiveOffer {
  id: string;
  avyayaId: string;
  folder: string;
  pct: string;
  merchant: string;
  desc: string;
  exp: string;
  campaignTier?: string;
  criterion?: string;
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

/**
 * Live-subscribe to offers pushed to this Avyaya ID for one folder —
 * mirrors subscribeInvoices. No-ops until Firebase is configured.
 */
export function subscribeOffers(
  avyayaId: string,
  folder: string,
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
        .filter((x) => x.folder === folder)
        .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
      onChange(list);
    },
    () => onChange([])
  );
}

/** Activates (or undoes activating) an offer from its detail sheet. */
export async function setOfferActivated(offerId: string, activated: boolean): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  await updateDoc(doc(db, "offers", offerId), {
    activated,
    activatedAtMs: activated ? Date.now() : null,
  });
}
