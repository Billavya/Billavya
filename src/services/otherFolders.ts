// From the standalone @firebase/firestore package, not the "firebase"
// wrapper's own bundled copy — see the long comment in src/config/firebase.ts
// for why mixing the two is the root cause of a real, confirmed launch crash.
import { doc, getDoc, onSnapshot, setDoc } from "@firebase/firestore";
import { db, isFirebaseConfigured } from "@/config/firebase";

/** A customer-created subfolder under Exclusive → Others, e.g. "Electronics" or "Travel". */
export interface OtherFolder {
  id: string;
  name: string;
  createdAtMs: number;
}

/** A customer may file invoices into at most this many custom "Other" subfolders. */
export const MAX_OTHER_FOLDERS = 5;

function generateFolderId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * All of a customer's custom "Other" folders live in one document (one
 * array field) rather than a subcollection — there are at most 5 of them
 * per customer, so a single doc read/write is simpler and cheaper than a
 * query every time the list is needed.
 */
function folderDocRef(avyayaId: string) {
  if (!db) throw new Error("Firebase isn't configured.");
  return doc(db, "otherFolders", avyayaId);
}

/** Live-subscribes to this customer's custom "Other" folders. No-ops (returns []) until Firebase is configured. */
export function subscribeOtherFolders(avyayaId: string, onChange: (folders: OtherFolder[]) => void): () => void {
  if (!isFirebaseConfigured || !db || !avyayaId) {
    onChange([]);
    return () => {};
  }
  return onSnapshot(
    folderDocRef(avyayaId),
    (snap) => {
      const data = snap.data();
      onChange((data?.folders as OtherFolder[] | undefined) ?? []);
    },
    () => onChange([])
  );
}

/**
 * Creates a new custom "Other" folder. Rejects once this customer already
 * has MAX_OTHER_FOLDERS — re-reads the current list first rather than
 * trusting a possibly-stale caller-held count, since another device could
 * have created one since this screen last synced.
 */
export async function createOtherFolder(avyayaId: string, name: string): Promise<OtherFolder> {
  if (!isFirebaseConfigured || !db) throw new Error("Firebase isn't configured.");
  const trimmed = name.trim();
  if (!trimmed) throw new Error("empty_name");
  const ref = folderDocRef(avyayaId);
  const snap = await getDoc(ref);
  const existing: OtherFolder[] = (snap.exists() && (snap.data().folders as OtherFolder[])) || [];
  if (existing.length >= MAX_OTHER_FOLDERS) throw new Error("max_folders_reached");
  const folder: OtherFolder = { id: generateFolderId(), name: trimmed, createdAtMs: Date.now() };
  await setDoc(ref, { folders: [...existing, folder] }, { merge: true });
  return folder;
}
