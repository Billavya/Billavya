import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "snapbill.profileId";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid look-alikes

function generateId(): string {
  let raw = "";
  for (let i = 0; i < 8; i++) {
    raw += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `SNB-${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/**
 * Every profile gets one ID, generated on first launch and persisted on-device
 * so the same person always sees the same QR/ID (there's no backend to issue one).
 */
export function useProfileId(): { id: string | null; qrValue: string } {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          if (!cancelled) setId(stored);
          return;
        }
        const fresh = generateId();
        await AsyncStorage.setItem(STORAGE_KEY, fresh);
        if (!cancelled) setId(fresh);
      } catch {
        if (!cancelled) setId(generateId());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { id, qrValue: id ? `snapbill://profile/${id}` : "" };
}
