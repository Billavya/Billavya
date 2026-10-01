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
// Every Firebase import in this file comes from the standalone @firebase/*
// packages directly — NEVER from the "firebase" convenience package's own
// subpaths ("firebase/app", "firebase/firestore", "firebase/auth", etc; see
// OnboardingFlow.tsx and account.ts, which do the same for auth).
//
// The real fix for the "Component auth has not been registered yet" crash
// that used to happen on every launch lives in metro.config.js, not here —
// see the long comment there for the full mechanism (short version:
// @firebase/app and @firebase/component each shipped as two different
// physical files, a CJS build and an ESM build, and Metro was handing
// different importers different copies depending on each file's own import
// style, so @firebase/auth's self-registration landed in a registry our own
// initializeApp() call never saw). metro.config.js forces every importer to
// the same physical file, so this file can stay simple.
//
// tsc's own module resolution doesn't apply Metro's conditions, so some of
// these exports are invisible to the type checker even though they're
// really there at runtime.
// @ts-expect-error — see above; these imports work fine at runtime on device.
import { initializeApp, getApps, type FirebaseApp } from "@firebase/app";
import { getFirestore, initializeFirestore, type Firestore } from "@firebase/firestore";
import { initializeAuth, getAuth, getReactNativePersistence, type Auth } from "@firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
let auth: Auth | null = null;
if (isFirebaseConfigured) {
  const app: FirebaseApp = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
  try {
    // Long-polling auto-detect keeps Firestore realtime reliable on React Native.
    db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  } catch {
    db = getFirestore(app);
  }
  try {
    // AsyncStorage persistence keeps a signed-in session across app restarts
    // on React Native (the web SDK's default persistence doesn't exist here).
    auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    auth = getAuth(app);
  }
}

export { db, auth };
