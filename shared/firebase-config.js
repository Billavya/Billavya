// SINGLE source of truth for the Firebase web config used by every
// standalone merchant page (pos-web, pos-web-grocery, campaign-restaurant,
// campaign-groceries) — previously this exact object was pasted
// independently into all 4 of those folders' own firebase-config.js, so
// rotating the API key meant hunting down and editing 4 separate files and
// risking missing one. Each of those files now just re-exports from here.
//
// This must still match src/config/firebase.ts — the React Native app has
// its own copy because Metro bundles it differently from these plain
// browser-loaded pages, not because it needed a separate value.
export const firebaseConfig = {
  apiKey: "AIzaSyC_-oQ0MY2anXHrD_Bm-4-exLmHRZb4Apk",
  authDomain: "letsgetdirty.firebaseapp.com",
  projectId: "letsgetdirty",
  storageBucket: "letsgetdirty.firebasestorage.app",
  messagingSenderId: "877273017008",
  appId: "1:877273017008:web:e2e643c331701fd33de975",
};
