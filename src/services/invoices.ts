import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
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
  snapbillId: string;
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
}

/**
 * Live-subscribe to invoices the POS has pushed for this SnapBill ID + folder.
 * Returns an unsubscribe function. No-ops (and returns []) until Firebase is
 * configured in src/config/firebase.ts.
 *
 * Uses a single equality filter (no composite index needed); folder filtering
 * and date sorting are done client-side.
 */
export function subscribeInvoices(
  snapbillId: string,
  folder: string,
  onChange: (invoices: LiveInvoice[]) => void
): () => void {
  if (!isFirebaseConfigured || !db || !snapbillId) {
    onChange([]);
    return () => {};
  }
  const q = query(collection(db, "invoices"), where("snapbillId", "==", snapbillId));
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
 * Live-subscribe to every invoice the POS has pushed for this SnapBill ID,
 * across all folders — used to roll new invoices into the home screen's
 * category totals, the top summary strip, and search/location filtering.
 */
export function subscribeAllInvoices(
  snapbillId: string,
  onChange: (invoices: LiveInvoice[]) => void
): () => void {
  if (!isFirebaseConfigured || !db || !snapbillId) {
    onChange([]);
    return () => {};
  }
  const q = query(collection(db, "invoices"), where("snapbillId", "==", snapbillId));
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
