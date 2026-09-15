import { useEffect, useMemo, useState } from "react";
import { useProfileId } from "@/utils/profileId";
import { subscribeAllInvoices, LiveInvoice } from "@/services/invoices";
import { ALL_INVOICES, FOLDERS, Folder, FolderIconKey } from "@/data/folders";
import { DEFAULT_LOCATION, inferLocation } from "@/utils/location";
import { useSeenInvoices } from "@/utils/seenInvoices";

export interface CombinedInvoice {
  key: string;
  folder: FolderIconKey;
  store: string;
  date: string;
  month: string;
  amount: number;
  location: string;
  live?: boolean;
  unseen?: boolean;
  favorite?: boolean;
  giftLabel?: boolean;
  warranty?: boolean;
  detail?: LiveInvoice;
  /** Set once this invoice has been passed to someone else — excluded from every count/sum. */
  transferredTo?: string | null;
}

export interface Bucket {
  count: number;
  amount: number;
}

export interface CombinedInvoicesResult {
  /** The curated sample invoices plus anything the POS has pushed for this profile. */
  invoices: CombinedInvoice[];
  /** Folder cards + top summary: each folder's baseline total with live invoices added on top. */
  folders: Folder[];
  totalCount: number;
  totalAmount: number;
  byFolder: Record<string, Bucket>;
  byLocation: Record<string, Bucket>;
  byMonth: Record<string, Bucket>;
  /** % change in spend, current calendar month vs. the immediately previous one — recomputed live. */
  trendPercent: number;
  /** Call once an invoice has been opened — clears its "NEW"/unseen indicator for good. */
  markSeen: (key: string) => void;
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthOf(dateLabel: string): string {
  return dateLabel.split(" ")[0] || "—";
}

/** Current month's spend vs. the previous month's, from the same data the Month chart uses. */
function computeTrend(byMonth: Record<string, Bucket>): number {
  const now = new Date();
  const current = MONTH_ABBR[now.getMonth()];
  const previous = MONTH_ABBR[(now.getMonth() + 11) % 12];
  const currentAmount = byMonth[current]?.amount ?? 0;
  const previousAmount = byMonth[previous]?.amount ?? 0;
  if (previousAmount > 0) return Math.round(((currentAmount - previousAmount) / previousAmount) * 100);
  return currentAmount > 0 ? 100 : 0;
}

/**
 * Single source of truth for "how many invoices, worth how much" — merges the
 * app's sample data with whatever the POS has actually pushed to this
 * profile's SnapBill ID, live. Used by the home screen (folder cards, top
 * summary strip, spend chart) and by Search, so every screen agrees.
 */
export function useCombinedInvoices(): CombinedInvoicesResult {
  const { id: myId } = useProfileId();
  const [live, setLive] = useState<LiveInvoice[]>([]);
  const { isSeen, markSeen } = useSeenInvoices();

  useEffect(() => {
    if (!myId) return;
    return subscribeAllInvoices(myId, setLive);
  }, [myId]);

  return useMemo(() => {
    const liveFlat: CombinedInvoice[] = live.map((li) => ({
      key: li.id,
      folder: li.folder as FolderIconKey,
      store: li.merchant,
      date: li.date,
      month: monthOf(li.date),
      amount: li.total,
      location: inferLocation(li.merchantAddress) || DEFAULT_LOCATION,
      live: true,
      unseen: !isSeen(li.id),
      favorite: li.favorite,
      giftLabel: li.giftLabel,
      warranty: li.warranty,
      detail: li,
      transferredTo: li.transferredTo,
    }));

    const staticFlat: CombinedInvoice[] = ALL_INVOICES.map((inv, i) => {
      const key = `${inv.folder}-${i}`;
      return {
        key,
        folder: inv.folder,
        store: inv.store,
        date: inv.date,
        month: monthOf(inv.date),
        amount: inv.amount,
        location: DEFAULT_LOCATION,
        unseen: !!inv.unseen && !isSeen(key),
      };
    });

    const invoices = [...liveFlat, ...staticFlat];

    // Live invoices add on top of each folder's baseline count/amount — the
    // baseline already represents more invoices than the few sample rows
    // shown in that folder's detail view. Transferred invoices are skipped —
    // they no longer belong to this profile's totals.
    const liveByFolder: Record<string, Bucket> = {};
    for (const li of live) {
      if (li.transferredTo) continue;
      const b = (liveByFolder[li.folder] ||= { count: 0, amount: 0 });
      b.count += 1;
      b.amount += li.total;
    }
    const folders: Folder[] = FOLDERS.map((f) => {
      const extra = liveByFolder[f.name];
      return extra ? { ...f, count: f.count + extra.count, amount: f.amount + extra.amount } : f;
    });
    const totalCount = folders.reduce((s, f) => s + f.count, 0);
    const totalAmount = folders.reduce((s, f) => s + f.amount, 0);

    const byFolder: Record<string, Bucket> = {};
    for (const f of folders) byFolder[f.name] = { count: f.count, amount: f.amount };

    const byLocation: Record<string, Bucket> = {};
    const byMonth: Record<string, Bucket> = {};
    for (const inv of invoices) {
      if (inv.transferredTo) continue;
      const l = (byLocation[inv.location] ||= { count: 0, amount: 0 });
      l.count += 1;
      l.amount += inv.amount;
      const m = (byMonth[inv.month] ||= { count: 0, amount: 0 });
      m.count += 1;
      m.amount += inv.amount;
    }

    return {
      invoices,
      folders,
      totalCount,
      totalAmount,
      byFolder,
      byLocation,
      byMonth,
      trendPercent: computeTrend(byMonth),
      markSeen,
    };
  }, [live, isSeen, markSeen]);
}
