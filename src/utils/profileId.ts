import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ID_KEY = "snapbill.profileId";
const NAME_KEY = "snapbill.profileName";
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
  return `SNB-${raw.slice(0, 4)}-${raw.slice(4)}`;
}

function generateName(): string {
  return NAMES[Math.floor(Math.random() * NAMES.length)];
}

/** Reads whichever SnapBill ID is already on this device, generating one if needed — without a hook. */
export async function getOrCreateProfileId(): Promise<string> {
  const stored = await AsyncStorage.getItem(ID_KEY);
  if (stored) return stored;
  const fresh = generateId();
  await AsyncStorage.setItem(ID_KEY, fresh);
  return fresh;
}

/** Overwrites this device's SnapBill ID — used when logging into an existing account from a new install. */
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

  return { id, name, qrValue: id ? `snapbill://profile/${id}` : "" };
}
