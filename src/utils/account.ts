import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ProfileRecord } from "@/services/profiles";

const STORAGE_KEY = "snapbill.account";

export interface Account {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  birthMonth: string;
  birthYear: string;
  city: string;
  snapbillId: string;
}

type Status = "loading" | "needs-onboarding" | "ready";

export interface UseAccountResult {
  status: Status;
  account: Account | null;
  /** Persists a freshly-created or freshly-logged-in account and unlocks the app. */
  setAccount: (account: Account) => Promise<void>;
  /**
   * Clears the saved account and returns to onboarding/login. This is the
   * ONLY thing that signs a user out — there is no session timeout or
   * automatic expiry anywhere in the app. Once logged in, a user stays
   * logged in indefinitely (across closing the app, restarting the phone,
   * days or months passing) until they explicitly log out here.
   */
  logout: () => Promise<void>;
}

function toAccount(p: ProfileRecord): Account {
  return {
    userId: p.userId,
    email: p.email,
    firstName: p.firstName,
    lastName: p.lastName,
    birthMonth: p.birthMonth,
    birthYear: p.birthYear,
    city: p.city,
    snapbillId: p.snapbillId,
  };
}

export function accountFromProfile(p: ProfileRecord): Account {
  return toAccount(p);
}

/**
 * Whether this device has a completed profile yet. Existing installs (from
 * before this feature) already have a SnapBill ID from useProfileId but no
 * account record — they land on "needs-onboarding" too, so they can create a
 * profile, but the onboarding flow re-uses their existing SnapBill ID rather
 * than minting a new one.
 */
export function useAccount(): UseAccountResult {
  const [status, setStatus] = useState<Status>("loading");
  const [account, setAccountState] = useState<Account | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        if (raw) {
          setAccountState(JSON.parse(raw));
          setStatus("ready");
        } else {
          setStatus("needs-onboarding");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("needs-onboarding");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setAccount = useCallback(async (next: Account) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setAccountState(next);
    setStatus("ready");
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setAccountState(null);
    setStatus("needs-onboarding");
  }, []);

  return { status, account, setAccount, logout };
}
