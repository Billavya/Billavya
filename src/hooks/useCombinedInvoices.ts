import { useEffect, useMemo, useState } from "react";
import { useProfileId } from "@/utils/profileId";
import { subscribeAllInvoices, LiveInvoice } from "@/services/invoices";
import { useLocaleCountry } from "@/config/locale";
import { ALL_INVOICES, FOLDERS, Folder, FolderIconKey } from "@/data/folders";
import { getDefaultLocation, inferLocation } from "@/utils/location";
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
  otherLabel?: boolean;
  otherFolderId?: string | null;
  detail?: LiveInvoice;
  /** Set once this invoice has been passed to someone else — excluded from every count/sum. */
  transferredTo?: string | null;
  /** Set once this invoice's bill has been split — your own portion, and the total people it was shared between (including you). */
  splitYourShare?: number | null;
  splitCount?: number | null;
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
  /**
   * Real current-calendar-month count/amount across every folder — what the
   * Home screen's "THIS MONTH" stat strip should actually show. `totalCount`/
   * `totalAmount` above are all-time; they used to be mislabeled "this
   * month" on screen even though nothing here actually filtered by month.
   */
  currentMonthCount: number;
  currentMonthAmount: number;
  /**
   * Per-folder current vs. previous calendar month totals — e.g. for the
   * Folder Detail screen's variance banner ("$450 this month, +12% vs last
   * month"). Keyed by folder name.
   */
  byFolderMonth: Record<string, { current: Bucket; previous: Bucket }>;
  /** Call once an invoice has been opened — clears its "NEW"/unseen indicator for good. */
  markSeen: (key: string) => void;
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthOf(dateLabel: string): string {
  return dateLabel.split(" ")[0] || "—";
}

/**
 * What a live invoice counts as everywhere EXCEPT its own detail copy: once
 * split, only your own share is real ongoing spend from here on out (the
 * rest is money you're owed back) — same treatment Transfer already gets,
 * just partial instead of total. The invoice's own receipt (items, subtotal,
 * "Total paid") is untouched — that reads `total` straight off `detail`.
 */
function effectiveAmount(li: LiveInvoice): number {
  return li.splitYourShare ?? li.total;
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
 * profile's Avyaya ID, live. Used by the home screen (folder cards, top
 * summary strip, spend chart) and by Search, so every screen agrees.
 */
export function useCombinedInvoices(): CombinedInvoicesResult {
  const { id: myId } = useProfileId();
  const country = useLocaleCountry();
  const [live, setLive] = useState<LiveInvoice[]>([]);
  const { isSeen, markSeen } = useSeenInvoices();

  useEffect(() => {
    if (!myId) return;
    return subscribeAllInvoices(myId, country, setLive);
  }, [myId, country]);

  return useMemo(() => {
    const liveFlat: CombinedInvoice[] = live.map((li) => ({
      key: li.id,
      folder: li.folder as FolderIconKey,
      store: li.merchant,
      date: li.date,
      month: monthOf(li.date),
      amount: effectiveAmount(li),
      location: inferLocation(li.merchantAddress) || getDefaultLocation(country),
      live: true,
      unseen: !isSeen(li.id),
      favorite: li.favorite,
      giftLabel: li.giftLabel,
      warranty: li.warranty,
      otherLabel: li.otherLabel,
      otherFolderId: li.otherFolderId,
      detail: li,
      transferredTo: li.transferredTo,
      splitYourShare: li.splitYourShare,
      splitCount: li.splitCount,
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
        location: getDefaultLocation(country),
        unseen: !!inv.unseen && !isSeen(key),
      };
    });

    const invoices = [...liveFlat, ...staticFlat];

    // Folder cards and the top summary strip show ONLY real, POS-pushed
    // invoices — no fixed baseline number mixed in. FOLDERS used to carry a
    // hardcoded starting count/amount per folder (e.g. Groceries always
    // "started" at 24 invoices / ₹6,180) that got added on top of whatever
    // was actually live, so the total was never really zero and never fully
    // real. Every folder now starts at 0 and grows only from real activity.
    // Transferred invoices are skipped — they no longer belong to this
    // profile's totals. Split invoices count for only your own share (see
    // effectiveAmount above).
    const liveByFolder: Record<string, Bucket> = {};
    for (const li of live) {
      if (li.transferredTo) continue;
      const b = (liveByFolder[li.folder] ||= { count: 0, amount: 0 });
      b.count += 1;
      b.amount += effectiveAmount(li);
    }
    const folders: Folder[] = FOLDERS.map((f) => {
      const extra = liveByFolder[f.name];
      return { ...f, count: extra?.count ?? 0, amount: extra?.amount ?? 0 };
    });
    const totalCount = folders.reduce((s, f) => s + f.count, 0);
    const totalAmount = folders.reduce((s, f) => s + f.amount, 0);

    const byFolder: Record<string, Bucket> = {};
    for (const f of folders) byFolder[f.name] = { count: f.count, amount: f.amount };

    const byLocation: Record<string, Bucket> = {};
    const byMonth: Record<string, Bucket> = {};
    const byFolderMonth: Record<string, { current: Bucket; previous: Bucket }> = {};
    const now = new Date();
    const currentMonthAbbr = MONTH_ABBR[now.getMonth()];
    const previousMonthAbbr = MONTH_ABBR[(now.getMonth() + 11) % 12];
    for (const inv of invoices) {
      if (inv.transferredTo) continue;
      const l = (byLocation[inv.location] ||= { count: 0, amount: 0 });
      l.count += 1;
      l.amount += inv.amount;
      const m = (byMonth[inv.month] ||= { count: 0, amount: 0 });
      m.count += 1;
      m.amount += inv.amount;

      const fm = (byFolderMonth[inv.folder] ||= {
        current: { count: 0, amount: 0 },
        previous: { count: 0, amount: 0 },
      });
      if (inv.month === currentMonthAbbr) {
        fm.current.count += 1;
        fm.current.amount += inv.amount;
      } else if (inv.month === previousMonthAbbr) {
        fm.previous.count += 1;
        fm.previous.amount += inv.amount;
      }
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
      currentMonthCount: byMonth[currentMonthAbbr]?.count ?? 0,
      currentMonthAmount: byMonth[currentMonthAbbr]?.amount ?? 0,
      byFolderMonth,
      markSeen,
    };
  }, [live, isSeen, markSeen, country]);
}
