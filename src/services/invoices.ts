// From the standalone @firebase/firestore package, not the "firebase"
// wrapper's own bundled copy — see the long comment in src/config/firebase.ts
// for why mixing the two is the root cause of a real, confirmed launch crash.
import { collection, doc, onSnapshot, query, updateDoc, where } from "@firebase/firestore";
import { db, isFirebaseConfigured } from "@/config/firebase";

export interface InvoiceItem {
  name: string;
  qty: number;
  unit: number;
  variant?: string | null;
  amount?: number;
}

/** An invoice pushed from the POS and stored in Firestore. */
export interface LiveInvoice {
  id: string;
  avyayaId: string;
  folder: string;
  merchant: string;
  merchantAddress?: string;
  gstin?: string;
  date: string;
  createdAtMs: number;
  invoiceNo?: string;
  table?: string;
  orderType?: string;
  items?: InvoiceItem[];
  subtotal?: number;
  tax?: number;
  discount?: number;
  total: number;
  /** Set once this invoice has been handed off to someone else via the Transfer tab. */
  transferredTo?: string | null;
  transferredAt?: number | null;
  /** Starred from the invoice detail view. */
  favorite?: boolean;
  /** Tagged as a gift purchase — also surfaced in the Exclusive folder. */
  giftLabel?: boolean;
  /** Tagged as covered by a product warranty — also surfaced in the Exclusive folder. */
  warranty?: boolean;
  /** Catch-all Exclusive tag for anything that isn't specifically a gift or warranty item. */
  otherLabel?: boolean;
  /** Set once this invoice's Split flow has been sent — your own portion, and how many people shared it in total (including you). Also surfaces it in the Exclusive/Special folder. */
  splitYourShare?: number | null;
  splitCount?: number | null;
  /** The other people it was split with (not including you) and what each owes. */
  splitPeople?: SplitParticipant[] | null;
  splitAtMs?: number | null;
}

export interface SplitParticipant {
  name: string;
  share: number;
}

/**
 * Live-subscribe to invoices the POS has pushed for this Avyaya ID + folder.
 * Returns an unsubscribe function. No-ops (and returns []) until Firebase is
 * configured in src/config/firebase.ts.
 *
 * Uses a single equality filter (no composite index needed); folder filtering
 * and date sorting are done client-side.
 */
export function subscribeInvoices(
  avyayaId: string,
  folder: string,
  onChange: (invoices: LiveInvoice[]) => void
): () => void {
  if (!isFirebaseConfigured || !db || !avyayaId) {
    onChange([]);
    return () => {};
  }
  const q = query(collection(db, "invoices"), where("avyayaId", "==", avyayaId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<LiveInvoice, "id">) }))
        .filter((x) => x.folder === folder)
        .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
      onChange(list);
    },
    () => onChange([])
  );
}

/**
 * Live-subscribe to every invoice the POS has pushed for this Avyaya ID,
 * across all folders — used to roll new invoices into the home screen's
 * category totals, the top summary strip, and search/location filtering.
 */
export function subscribeAllInvoices(
  avyayaId: string,
  onChange: (invoices: LiveInvoice[]) => void
): () => void {
  if (!isFirebaseConfigured || !db || !avyayaId) {
    onChange([]);
    return () => {};
  }
  const q = query(collection(db, "invoices"), where("avyayaId", "==", avyayaId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<LiveInvoice, "id">) }))
        .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
      onChange(list);
    },
    () => onChange([])
  );
}

/**
 * Hands an invoice off to someone else — it stops counting toward this
 * profile's invoice count and totals everywhere in the app, and is shown as a
 * negative balance instead wherever it's still visible. Pass `null` to undo.
 */
export async function transferInvoice(invoiceId: string, toName: string | null): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  await updateDoc(doc(db, "invoices", invoiceId), {
    transferredTo: toName,
    transferredAt: toName ? Date.now() : null,
  });
}

/** Stars or unstars an invoice from the detail view's top-right corner. */
export async function setInvoiceFavorite(invoiceId: string, favorite: boolean): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  await updateDoc(doc(db, "invoices", invoiceId), { favorite });
}

/** Tags/untags an invoice as a gift purchase — also surfaces it in the Exclusive folder. */
export async function setInvoiceGift(invoiceId: string, giftLabel: boolean): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  await updateDoc(doc(db, "invoices", invoiceId), { giftLabel });
}

/** Tags/untags an invoice as covered by a warranty — also surfaces it in the Exclusive folder. */
export async function setInvoiceWarranty(invoiceId: string, warranty: boolean): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  await updateDoc(doc(db, "invoices", invoiceId), { warranty });
}

/** Tags/untags an invoice with the catch-all Exclusive → Others label. */
export async function setInvoiceOther(invoiceId: string, otherLabel: boolean): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  await updateDoc(doc(db, "invoices", invoiceId), { otherLabel });
}

/**
 * Records that this invoice's bill has been split — your own portion, and
 * how many people shared it in total (including you). This doesn't change
 * what the invoice counts as in your spend totals (you did pay the whole
 * thing) — it's purely a record, surfaced as a banner on the invoice itself
 * and cross-referenced in the Special → Split folder.
 */
export async function setInvoiceSplit(
  invoiceId: string,
  yourShare: number,
  splitCount: number,
  people: SplitParticipant[]
): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  await updateDoc(doc(db, "invoices", invoiceId), {
    splitYourShare: yourShare,
    splitCount,
    splitPeople: people,
    splitAtMs: Date.now(),
  });
}
