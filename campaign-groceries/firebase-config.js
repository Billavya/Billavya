// Re-exports the one shared config — see ../shared/firebase-config.js.
// Note: this page must be served from the PROJECT ROOT (not from inside
// campaign-groceries/ directly), so this relative "../shared/..." path
// resolves — e.g. `python3 -m http.server` run from the project root, then
// open http://localhost:PORT/campaign-groceries/index.html.
export { firebaseConfig } from "../shared/firebase-config.js";
