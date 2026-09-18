import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/config/firebase";
import { DeviceInfo } from "@/utils/device";

export interface ProfileRecord {
  userId: string;
  password: string;
  email: string;
  firstName: string;
  lastName: string;
  /** Optional since the standard sign-up form only asks for name/email/password —
   *  older accounts created through the original 5-step wizard still have these. */
  birthMonth?: string;
  birthYear?: string;
  city?: string;
  snapbillId: string;
  createdAtMs: number;
  /** Whatever device info is readable without a native module — see src/utils/device.ts. */
  device?: DeviceInfo;
}

function key(userId: string): string {
  return userId.trim().toLowerCase();
}

/**
 * NOTE ON SECURITY: this is a preview/demo app. Profiles (including the
 * plaintext password) are stored in a Firestore collection that currently has
 * open test-mode rules — fine for trying the flow out, but this must move to
 * real Firebase Authentication (which never stores or transmits raw
 * passwords) plus locked-down Firestore rules before any real user's
 * credentials go anywhere near it.
 */

export async function isUserIdAvailable(userId: string): Promise<boolean> {
  if (!isFirebaseConfigured || !db) return true;
  const snap = await getDoc(doc(db, "profiles", key(userId)));
  return !snap.exists();
}

export async function createProfile(profile: ProfileRecord): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error("Firebase isn't configured on this build.");
  await setDoc(doc(db, "profiles", key(profile.userId)), profile);
}

/** Looks a profile up by user ID first, then by email if that doesn't match. */
export async function findProfile(identifier: string): Promise<ProfileRecord | null> {
  if (!isFirebaseConfigured || !db) return null;
  const trimmed = identifier.trim();

  const byId = await getDoc(doc(db, "profiles", key(trimmed)));
  if (byId.exists()) return byId.data() as ProfileRecord;

  const q = query(collection(db, "profiles"), where("email", "==", trimmed.toLowerCase()));
  const snap = await getDocs(q);
  if (!snap.empty) return snap.docs[0].data() as ProfileRecord;

  return null;
}

/**
 * Refreshes the device info on an existing profile — called on every app
 * launch so accounts created before device tracking existed get backfilled,
 * and so the record stays current if someone moves to a new phone.
 */
export async function updateProfileDevice(userId: string, device: DeviceInfo): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  await updateDoc(doc(db, "profiles", key(userId)), { device });
}
