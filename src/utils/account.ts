import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
// Deliberately @firebase/auth, not the firebase/auth wrapper — see the long
// comment in src/config/firebase.ts for why mixing the two crashes the app.
import { signOut } from "@firebase/auth";
import { auth } from "@/config/firebase";
import { ProfileRecord, updateProfileCountry } from "@/services/profiles";
import { DeviceInfo } from "@/utils/device";
import { CountryCode, setCountry as setLocaleCountry } from "@/config/locale";

const STORAGE_KEY = "avyaya.account";

export interface Account {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  birthMonth?: string;
  birthYear?: string;
  city?: string;
  /** Which country's currency/tax rules this account uses — see the
   *  Country/Region row in Profile and src/config/locale.ts. Falls back to
   *  this build's own default when an account predates the switcher. */
  country?: CountryCode;
  avyayaId: string;
  device?: DeviceInfo;
}

type Status = "loading" | "needs-onboarding" | "ready";

export interface UseAccountResult {
  status: Status;
  account: Account | null;
  /** Persists a freshly-created or freshly-logged-in account and unlocks the app. */
  setAccount: (account: Account) => Promise<void>;
  /** Updates just the cached device info (after re-syncing it to Firestore). */
  setDevice: (device: DeviceInfo) => void;
  /** Switches this account's country — updates the live LOCALE store
   *  immediately (see src/config/locale.ts), then persists to AsyncStorage
   *  and Firestore in the background. */
  setCountry: (country: CountryCode) => void;
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
    country: p.country,
    avyayaId: p.avyayaId,
    device: p.device,
  };
}

export function accountFromProfile(p: ProfileRecord): Account {
  return toAccount(p);
}

/**
 * Whether this device has a completed profile yet. Existing installs (from
 * before this feature) already have a Avyaya ID from useProfileId but no
 * account record — they land on "needs-onboarding" too, so they can create a
 * profile, but the onboarding flow re-uses their existing Avyaya ID rather
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
          const parsed: Account = JSON.parse(raw);
          // Same stale-local-cache issue as profileId.ts's SNB-/AVY- fix —
          // a device that signed in before the rebrand has this exact old
          // ID baked into its cached account blob, untouched by the backend
          // migration. Corrected in place the first time it's loaded here.
          if (parsed.avyayaId?.startsWith("SNB-")) {
            parsed.avyayaId = "AVY-" + parsed.avyayaId.slice(4);
            AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(parsed)).catch(() => {});
          }
          // Sync the live LOCALE store to whatever country this account last
          // chose, BEFORE anything renders off of it — a reload otherwise
          // has a one-frame flash of the build's own default country.
          if (parsed.country) setLocaleCountry(parsed.country);
          setAccountState(parsed);
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
    if (next.country) setLocaleCountry(next.country);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setAccountState(next);
    setStatus("ready");
  }, []);

  const setCountry = useCallback((country: CountryCode) => {
    setLocaleCountry(country); // updates everything reading LOCALE immediately
    setAccountState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, country };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      updateProfileCountry(prev.email, country).catch(() => {
        // Local switch already applied — a failed background sync just
        // means a second device won't see it yet, not worth surfacing here.
      });
      return next;
    });
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    if (auth) {
      await signOut(auth).catch(() => {});
    }
    setAccountState(null);
    setStatus("needs-onboarding");
  }, []);

  const setDevice = useCallback((device: DeviceInfo) => {
    setAccountState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, device };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return { status, account, setAccount, setDevice, setCountry, logout };
}
