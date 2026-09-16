import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/config/firebase";

/** An offer a merchant's campaign has pushed to a specific SnapBill ID. */
export interface LiveOffer {
  id: string;
  snapbillId: string;
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
}

/**
 * Live-subscribe to offers pushed to this SnapBill ID for one folder —
 * mirrors subscribeInvoices. No-ops until Firebase is configured.
 */
export function subscribeOffers(
  snapbillId: string,
  folder: string,
  onChange: (offers: LiveOffer[]) => void
): () => void {
  if (!isFirebaseConfigured || !db || !snapbillId) {
    onChange([]);
    return () => {};
  }
  const q = query(collection(db, "offers"), where("snapbillId", "==", snapbillId));
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
