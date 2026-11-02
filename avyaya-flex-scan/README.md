# Avyaya Flex Scan

Standalone native app for Clover Flex: cashier taps **Scan Customer QR**, the customer holds
up their Avyaya QR (`avyaya://profile/AVY-XXXX-XXXX`), and the screen shows their active offers
and discount %, pulled from the already-deployed `lookupOffers` Cloud Function.

Not wired into Clover's own checkout/order/tender flow — it's a separate screen the cashier
opens manually, which is what made this buildable without touching Clover's Order APIs.

## What's real vs. what's not

- **Offers + discount %** — fully wired to the existing `exports.lookupOffers` Cloud Function
  (`functions/index.js`). No new backend work.
- **Loyalty points** — NOT shown. Avyaya has no live points balance/ledger today (confirmed in
  `functions/index.js`'s own comments) — only an optional number stored per-invoice after the
  fact. The screen says "Loyalty points: not available yet" rather than fake data. Building a
  real balance (accumulate on `receiveInvoice`, expose a lookup endpoint) is separate work.
- **The QR itself** is a static per-install ID (`src/utils/profileId.ts`), not a rotating token.

## Before you can build this

This machine has no Android SDK, JDK, or Gradle installed, so this project has **not** been
compiled here — install **Android Studio** (which bundles a JDK and the SDK manager), open this
folder, and let Gradle Sync run. The dependency `com.clover.sdk:clover-android-sdk:323` is
confirmed published on Maven Central, and the `BarcodeScanner`/`BarcodeResult` usage in
`MainActivity.java` is copied in structure from Clover's own verified sample
(`clover-android-sdk-examples/.../BarcodeScannerTestActivity.java`) — but a real Gradle sync and
build on your machine is the first real compile check.

## Setup

1. Open this folder in Android Studio, let Gradle Sync finish.
2. Build → Build Bundle(s)/APK(s) → Build APK(s). Find it under `app/build/outputs/apk/debug/`.
3. On first launch on the Flex, tap **Set merchant API key** and enter the Avyaya merchant's
   `apiKey` (the same one `pos-web`/`merchant-portal` already use against this backend — see
   `scripts/generate-pos-api-key.mjs` in `snapbill-expo` if you need to mint/look one up).
4. In the Clover Developer Dashboard → your app → **App Settings → Android APKs**, upload the
   built APK. That's the step that was blocking the app from appearing on the Flex at all.
5. Install to your test merchant from **Installs**, confirm the Flex (already associated with
   that merchant) now shows the app in its App Market/home screen.

## Testing the scan on the Flex itself

`BarcodeScanner`/`BarcodeResult` only work on real Clover hardware (they talk to the device's
actual camera/scanner service) — there's no emulator path for this part. First real test has to
be on the physical Flex 4 you already activated.
