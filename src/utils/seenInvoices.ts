import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "avyaya.seenInvoices";

/**
 * Tracks which invoices this device has opened, so their "NEW"/unseen
 * indicator clears permanently once viewed — not just for the current
 * session. Local per-device state; not synced to Firestore.
 */
export function useSeenInvoices(): { isSeen: (key: string) => boolean; markSeen: (key: string) => void } {
  const [seen, setSeen] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        setSeen(new Set(JSON.parse(raw)));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const markSeen = useCallback((key: string) => {
    setSeen((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next))).catch(() => {});
      return next;
    });
  }, []);

  const isSeen = useCallback((key: string) => seen.has(key), [seen]);

  return { isSeen, markSeen };
}
