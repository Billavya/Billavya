import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ID_KEY = "avyaya.profileId";
const NAME_KEY = "avyaya.profileName";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid look-alikes

// A different name is drawn from this pool on first launch, so two people who
// each download the app (Android or iOS) don't both see "Ananya".
const NAMES = [
  "Ananya", "Aarav", "Priya", "Rohan", "Isha", "Kabir", "Meera", "Vikram", "Diya", "Arjun",
  "Sneha", "Karan", "Neha", "Aditya", "Pooja", "Rahul", "Tanvi", "Siddharth", "Riya", "Varun",
  "Kavya", "Nikhil", "Anjali", "Rajesh", "Simran", "Aryan", "Divya", "Manish", "Shreya", "Yash",
];

function generateId(): string {
  let raw = "";
  for (let i = 0; i < 8; i++) {
    raw += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `AVY-${raw.slice(0, 4)}-${raw.slice(4)}`;
}

function generateName(): string {
  return NAMES[Math.floor(Math.random() * NAMES.length)];
}

/**
 * Devices that first launched before the SnapBill->Avyaya rebrand still have
 * their old "SNB-" ID cached here — the backend migration that renamed
 * Firestore's profiles/invoices/offers documents to "AVY-" has no way to
 * reach a phone's local AsyncStorage, so those devices kept showing their
 * old ID forever despite the backend being fully migrated. This corrects it
 * in place the first time it's read on any such device, from here on.
 */
function normalizeId(id: string): string {
  return id.startsWith("SNB-") ? "AVY-" + id.slice(4) : id;
}

/** Reads whichever Avyaya ID is already on this device, generating one if needed — without a hook. */
export async function getOrCreateProfileId(): Promise<string> {
  const stored = await AsyncStorage.getItem(ID_KEY);
  if (stored) {
    const normalized = normalizeId(stored);
    if (normalized !== stored) await AsyncStorage.setItem(ID_KEY, normalized);
    return normalized;
  }
  const fresh = generateId();
  await AsyncStorage.setItem(ID_KEY, fresh);
  return fresh;
}

/** Overwrites this device's Avyaya ID — used when logging into an existing account from a new install. */
export async function setProfileId(id: string): Promise<void> {
  await AsyncStorage.setItem(ID_KEY, id);
}

/**
 * Every profile gets one ID and one display name, generated on first launch
 * and persisted on-device — so the same install always sees the same
 * QR/ID/name (there's no backend to issue one), and a fresh install (a new
 * download, on either platform) gets its own random name instead of
 * everyone seeing "Ananya".
 */
export function useProfileId(): { id: string | null; name: string | null; qrValue: string } {
  const [id, setId] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let [storedId, storedName] = await Promise.all([
          AsyncStorage.getItem(ID_KEY),
          AsyncStorage.getItem(NAME_KEY),
        ]);
        if (!storedId) {
          storedId = generateId();
          await AsyncStorage.setItem(ID_KEY, storedId);
        } else {
          const normalized = normalizeId(storedId);
          if (normalized !== storedId) {
            storedId = normalized;
            await AsyncStorage.setItem(ID_KEY, storedId);
          }
        }
        if (!storedName) {
          storedName = generateName();
          await AsyncStorage.setItem(NAME_KEY, storedName);
        }
        if (!cancelled) {
          setId(storedId);
          setName(storedName);
        }
      } catch {
        if (!cancelled) {
          setId(generateId());
          setName(generateName());
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { id, name, qrValue: id ? `avyaya://profile/${id}` : "" };
}
