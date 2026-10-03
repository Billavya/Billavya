// Re-exports the one shared config — see ../shared/firebase-config.js.
// Note: this page must be served from the PROJECT ROOT (not from inside
// pos-web/ directly), so this relative "../shared/..." path resolves —
// e.g. `python3 -m http.server` run from the project root, then open
// http://localhost:PORT/pos-web/index.html.
export { firebaseConfig } from "../shared/firebase-config.js";
