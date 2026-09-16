import { collection, onSnapshot, query, where } from "firebase/firestore";
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
