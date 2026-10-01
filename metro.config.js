// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// ─────────────────────────────────────────────────────────────────────────
// Firebase "Component auth has not been registered yet" fix — confirmed
// 2026-10-01 via on-device instrumentation and direct inspection of the
// exported JS bundle.
//
// Root cause: @firebase/app, @firebase/component (and transitively
// @firebase/util, @firebase/logger) each ship BOTH a CommonJS build
// (dist/index.cjs.js, matching package.json's "require" export condition)
// and an ESM build (dist/esm/index.esm2017.js, matching "default"). Metro
// picks between them per *importing file*, based on whether that file's own
// source used an ES `import` or a CJS `require()` — not globally. Our own
// TypeScript source (src/config/firebase.ts, using `import ... from
// "@firebase/app"`) resolves to the ESM build. @firebase/auth's own
// published code is already-compiled, plain CommonJS (literal
// `require('@firebase/app')` calls inside its dist files) and resolves to
// the CJS build instead. Two different physical module instances, each
// with its own independent module-level component registry — so
// @firebase/auth's self-registration (`registerAuth()`, a top-level import
// side effect) registers "auth" onto a registry our own initializeApp()
// call never sees, no matter how late it runs or how many times retried.
//
// Fix: force these specific packages to resolve to ONE canonical file for
// every importer, regardless of each importer's own module format — exactly
// matching how Node's single-condition resolution behaves, and how these
// packages worked before multi-format "exports" maps existed at all.
// ─────────────────────────────────────────────────────────────────────────
const FIREBASE_CJS_OVERRIDES = {
  "@firebase/app": "node_modules/@firebase/app/dist/index.cjs.js",
  "@firebase/component": "node_modules/@firebase/component/dist/index.cjs.js",
  "@firebase/logger": "node_modules/@firebase/logger/dist/index.cjs.js",
  "@firebase/util": "node_modules/@firebase/util/dist/index.cjs.js",
};

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const override = FIREBASE_CJS_OVERRIDES[moduleName];
  if (override) {
    return {
      type: "sourceFile",
      filePath: path.join(__dirname, override),
    };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
