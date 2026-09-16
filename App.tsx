import React, { useCallback, useEffect, useRef } from "react";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from "expo-updates";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppState, View } from "react-native";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold } from "@expo-google-fonts/sora";

import { RootNavigator } from "@/navigation/RootNavigator";
import { ToastProvider } from "@/components/Toast";
import { AmountVisibilityProvider } from "@/components/AmountVisibility";
import { colors } from "@/theme/colors";
import { useAccount } from "@/utils/account";
import { OnboardingFlow } from "@/onboarding/OnboardingFlow";
import { getDeviceInfo } from "@/utils/device";
import { updateProfileDevice } from "@/services/profiles";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Sora_600SemiBold,
    Sora_700Bold,
    Sora_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  // Pull and apply any newer OTA update right away, instead of waiting for a
  // second relaunch (expo-updates' normal default behavior). Runs on cold
  // launch AND every time the app is foregrounded — most people switch back
  // into an app rather than fully force-quitting it, and a check that only
  // ever fires once at mount can leave someone stuck on a stale bundle for
  // days without any sign anything is wrong.
  const checkingUpdate = useRef(false);
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    async function checkAndApply() {
      if (checkingUpdate.current) return;
      checkingUpdate.current = true;
      try {
        const check = await Updates.checkForUpdateAsync();
        if (check.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch {
        // Offline, or the check failed — keep running on whatever bundle is already loaded.
      } finally {
        checkingUpdate.current = false;
      }
    }
    checkAndApply();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") checkAndApply();
    });
    return () => sub.remove();
  }, []);

  const onLayoutRootView = useCallback(() => {}, []);
  const { status, account, setAccount, setDevice } = useAccount();

  // Keeps device info current on every launch — backfills it for accounts
  // created before this existed, and re-syncs it if someone's moved phones.
  useEffect(() => {
    if (status !== "ready" || !account) return;
    const info = getDeviceInfo();
    setDevice(info);
    updateProfileDevice(account.userId, info).catch(() => {});
  }, [status, account?.userId]);

  if (!fontsLoaded && !fontError) {
    return null;
  }
  // Same brief gate as the font check — avoids flashing onboarding before we
  // know whether this device already has an account.
  if (status === "loading") {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.appBg }} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <ToastProvider>
          <AmountVisibilityProvider>
            {status === "needs-onboarding" ? (
              <>
                <StatusBar style="dark" />
                <OnboardingFlow onComplete={setAccount} />
              </>
            ) : (
              <NavigationContainer>
                <StatusBar style="dark" />
                <RootNavigator />
              </NavigationContainer>
            )}
          </AmountVisibilityProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </View>
  );
}
