/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  FIREBASE — one-time setup so the web POS can push invoices into this app
 * ─────────────────────────────────────────────────────────────────────────────
 *  1. Go to https://console.firebase.google.com  →  "Add project" (free).
 *  2. Build → Firestore Database → "Create database" → Start in TEST MODE
 *     (test mode = open read/write for 30 days; fine for a demo).
 *  3. Project settings (gear icon) → "Your apps" → Web app  ( </> )  → register.
 *  4. Copy the `firebaseConfig` object it shows and paste it below, replacing
 *     the empty strings.
 *  5. Paste the SAME values into  ../../pos-web/firebase-config.js
 *
 *  Until this is filled in, the app still runs — the Food folder just shows the
 *  built-in sample invoices and does not receive anything from the POS.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC_-oQ0MY2anXHrD_Bm-4-exLmHRZb4Apk",
  authDomain: "letsgetdirty.firebaseapp.com",
  projectId: "letsgetdirty",
  storageBucket: "letsgetdirty.firebasestorage.app",
  messagingSenderId: "877273017008",
  appId: "1:877273017008:web:e2e643c331701fd33de975",
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let db: Firestore | null = null;
if (isFirebaseConfigured) {
  const app: FirebaseApp = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
  try {
    // Long-polling auto-detect keeps Firestore realtime reliable on React Native.
    db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  } catch {
    db = getFirestore(app);
  }
}

export { db };
