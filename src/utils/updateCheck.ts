import { useState } from "react";
import { Alert } from "react-native";
import * as Updates from "expo-updates";

/**
 * A visible "which bundle am I on" readout — every OTA-lag question this
 * app gets ("I can see X but not Y") comes down to two installs being on
 * different updates. This makes that checkable at a glance instead of by
 * guesswork: the short update id + when it was fetched, so it's obvious
 * whether a device has actually picked up the latest `eas update` yet.
 *
 * Originally only shown on the Profile screen — also surfaced on the
 * login/signup screen (see OnboardingFlow.tsx) because Profile is behind a
 * login wall, so anyone stuck failing to sign in has no way to check this
 * otherwise, which is exactly the situation this is most useful in.
 */
export function buildLabel(): string {
  if (__DEV__) return "Dev build (no updates)";
  if (!Updates.isEnabled) return "Updates disabled";
  if (Updates.isEmbeddedLaunch || !Updates.updateId) return "Embedded build — no update applied yet";
  const short = Updates.updateId.replace(/-/g, "").slice(0, 8);
  const when = Updates.createdAt
    ? new Date(Updates.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "unknown time";
  return `Build ${short} · fetched ${when}`;
}

/**
 * A manual, on-demand escape hatch for update lag: the automatic check only
 * runs on cold launch and on foregrounding, so an app that's been sitting
 * open the whole time (never actually backgrounded) never gets a chance to
 * notice a new update exists. This lets someone force that check right now
 * instead of needing to force-quit and hope.
 */
export function useUpdateCheck() {
  const [checking, setChecking] = useState(false);

  async function checkForUpdateNow(onUpdateFound?: () => void) {
    if (__DEV__) {
      Alert.alert("Dev build", "Updates don't apply in a dev build.");
      return;
    }
    if (!Updates.isEnabled) {
      Alert.alert("Updates disabled", "expo-updates reports Updates.isEnabled = false on this build.");
      return;
    }
    if (checking) return;
    setChecking(true);
    try {
      const check = await Updates.checkForUpdateAsync();
      if (check.isAvailable) {
        onUpdateFound?.();
        try {
          await Updates.fetchUpdateAsync();
        } catch (fetchErr) {
          Alert.alert("Update found, but download failed", String((fetchErr as any)?.message ?? fetchErr));
          return;
        }
        await Updates.reloadAsync();
      } else {
        // Distinguish the two very different reasons this can happen — "the
        // server has nothing newer" vs. "checkForUpdateAsync silently found
        // nothing to say" — by showing exactly what the SDK reported.
        Alert.alert(
          "No update applied",
          `checkForUpdateAsync() says no update is available.\n\n` +
            `Current: ${Updates.isEmbeddedLaunch ? "embedded build" : Updates.updateId ?? "unknown"}\n` +
            `Channel: ${(Updates as any).channel ?? "unknown"}\n` +
            `Runtime: ${Updates.runtimeVersion ?? "unknown"}\n` +
            `Reason field: ${JSON.stringify((check as any).reason ?? null)}`
        );
      }
    } catch (err) {
      Alert.alert(
        "Update check failed",
        `${String((err as any)?.message ?? err)}\n\ncode: ${(err as any)?.code ?? "n/a"}`
      );
    } finally {
      setChecking(false);
    }
  }

  return { checking, checkForUpdateNow };
}
