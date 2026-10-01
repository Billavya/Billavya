// From the standalone @firebase/firestore package, not the "firebase"
// wrapper's own bundled copy — see the long comment in src/config/firebase.ts
// for why mixing the two is the root cause of a real, confirmed launch crash.
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "@firebase/firestore";
import { db, isFirebaseConfigured } from "@/config/firebase";
import { DeviceInfo } from "@/utils/device";

export interface ProfileRecord {
  /** The user's email — this IS the user ID. There's no separate handle to invent or remember. */
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  /** Optional since the standard sign-up form only asks for name/email/password —
   *  older accounts created through the original 5-step wizard still have these. */
  birthMonth?: string;
  birthYear?: string;
  city?: string;
  avyayaId: string;
  createdAtMs: number;
  /** Whatever device info is readable without a native module — see src/utils/device.ts. */
  device?: DeviceInfo;
}

function key(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Profiles hold everything about an account EXCEPT the password — that lives
 * only in Firebase Authentication, which hashes it and never round-trips it
 * back to any client. This collection still needs locked-down Firestore
 * rules (each doc readable/writable only by its matching authenticated
 * user) before this goes anywhere near real users — see firestore.rules.
 */

export async function isUserIdAvailable(email: string): Promise<boolean> {
  if (!isFirebaseConfigured || !db) return true;
  const snap = await getDoc(doc(db, "profiles", key(email)));
  return !snap.exists();
}

export async function createProfile(profile: ProfileRecord): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error("Firebase isn't configured on this build.");
  await setDoc(doc(db, "profiles", key(profile.email)), profile);
}

/** Looks a profile up by email (which is also the document key). */
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
export async function updateProfileDevice(email: string, device: DeviceInfo): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  await updateDoc(doc(db, "profiles", key(email)), { device });
}
