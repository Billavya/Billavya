import { useEffect, useRef, useState } from "react";
import { auth } from "@/config/firebase";

/**
 * Rotating per-transaction QR (see functions/transactionQr.js).
 *
 * The value this returns contains a short-lived ALIAS, never the account's
 * real Avyaya ID — so a photographed code reveals nothing about who the
 * customer is, and two codes for the same person aren't linkable.
 *
 * Every failure path falls back to the caller's static QR: not opted in
 * (403), signed out, offline, or a malformed response. Nothing that worked
 * before can break by this being switched on.
 */
const ISSUE_URL = "https://us-central1-letsgetdirty.cloudfunctions.net/issueTransactionQr";

// Refresh a little before expiry so a code held up at the counter is never
// mid-rollover at the exact moment it's scanned.
export const REFRESH_LEAD_MS = 45 * 1000;

export interface DynamicQr {
  qrValue: string;
  expiresAtMs: number;
}

async function requestDynamicQr(): Promise<DynamicQr | null> {
  const user = auth?.currentUser;
  if (!user) return null;
  const idToken = await user.getIdToken();
  const res = await fetch(ISSUE_URL, { method: "POST", headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok) return null; // 403 = not opted in; anything else = fall back to static
  const json = await res.json();
  if (!json?.success || !json.qrValue || !json.expiresAtMs) return null;
  return { qrValue: json.qrValue, expiresAtMs: json.expiresAtMs };
}

/**
 * Fetches a rotating code while `active` is true and keeps it fresh.
 * Returns null whenever the static QR should be shown instead.
 */
export function useDynamicQr(active: boolean): DynamicQr | null {
  const [dynamic, setDynamic] = useState<DynamicQr | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      setDynamic(null);
      return;
    }
    let cancelled = false;
    async function refresh() {
      const next = await requestDynamicQr().catch(() => null);
      if (cancelled) return;
      setDynamic(next);
      if (next) {
        const delay = Math.max(5000, next.expiresAtMs - Date.now() - REFRESH_LEAD_MS);
        timer.current = setTimeout(refresh, delay);
      }
    }
    refresh();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [active]);

  return dynamic;
}

export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
