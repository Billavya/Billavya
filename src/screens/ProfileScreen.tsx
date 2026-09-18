import React, { useState } from "react";
import { Alert, LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, Text, UIManager, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Updates from "expo-updates";
import QRCode from "react-native-qrcode-svg";
import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { useToast } from "@/components/Toast";
import { useProfileId } from "@/utils/profileId";
import { useAccount } from "@/utils/account";
import { formatDeviceLabel } from "@/utils/device";

/**
 * A visible "which bundle am I on" readout — every OTA-lag question this
 * app gets ("I can see X but not Y") comes down to two installs being on
 * different updates. This makes that checkable at a glance instead of by
 * guesswork: the short update id + when it was fetched, so it's obvious
 * whether a device has actually picked up the latest `eas update` yet.
 */
function buildLabel(): string {
  if (__DEV__) return "Dev build (no updates)";
  if (!Updates.isEnabled) return "Updates disabled";
  if (Updates.isEmbeddedLaunch || !Updates.updateId) return "Embedded build — no update applied yet";
  const short = Updates.updateId.replace(/-/g, "").slice(0, 8);
  const when = Updates.createdAt
    ? new Date(Updates.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "unknown time";
  return `Build ${short} · fetched ${when}`;
}

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ROWS: { label: string; value?: string }[] = [
  { label: "Account details" },
  { label: "Notifications" },
  { label: "Appearance", value: "Light" },
  { label: "Export & backup" },
  { label: "Help & support" },
];

export function ProfileScreen() {
  const { showToast } = useToast();
  const { id, qrValue } = useProfileId();
  const { account, logout } = useAccount();
  const [showId, setShowId] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  // A manual, on-demand escape hatch for update lag: the automatic check
  // only runs on cold launch and on foregrounding, so an app that's been
  // sitting open the whole time (never actually backgrounded) never gets a
  // chance to notice a new update exists. This lets someone force that
  // check right now instead of needing to force-quit and hope.
  async function checkForUpdateNow() {
    if (__DEV__ || !Updates.isEnabled || checkingUpdate) return;
    setCheckingUpdate(true);
    try {
      const check = await Updates.checkForUpdateAsync();
      if (check.isAvailable) {
        showToast("Update found — restarting…");
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      } else {
        showToast("You're already on the latest update");
      }
    } catch {
      showToast("Couldn't check for updates — check your connection");
    } finally {
      setCheckingUpdate(false);
    }
  }
  const displayName = account ? `${account.firstName} ${account.lastName}` : "Generating…";
  const initial = account?.firstName?.[0]?.toUpperCase() ?? "?";

  function toggleId() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowId((v) => !v);
  }

  function confirmLogout() {
    Alert.alert(
      "Log out?",
      `You'll need your User ID or email (${account?.email ?? ""}) and password to log back in. You'll stay logged in indefinitely otherwise — this is the only way to sign out.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Log out", style: "destructive", onPress: () => logout() },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Pressable
          style={({ pressed }) => [styles.avatar, pressed && styles.avatarPressed]}
          onPress={toggleId}
          accessibilityRole="button"
          accessibilityLabel={showId ? "Hide your SnapBill ID" : "Show your SnapBill ID"}
        >
          <Text style={styles.avatarText}>{initial}</Text>
        </Pressable>
        <Text style={styles.tapHint}>{showId ? "Tap to hide your ID" : "Tap your initial to view your ID"}</Text>

        {showId && (
          <View style={styles.idCard}>
            <View style={styles.qrWrap}>
              {id ? (
                <QRCode value={qrValue} size={148} color={colors.navy} backgroundColor={colors.card} />
              ) : (
                <View style={[styles.qrWrap, { width: 148, height: 148 }]} />
              )}
            </View>
            <Text style={styles.idLabel}>YOUR SNAPBILL ID</Text>
            <Text style={styles.idValue}>{id ?? "Generating…"}</Text>
            <Text style={styles.idCaption}>Unique to this profile — show it to link invoices at partner checkouts.</Text>
          </View>
        )}

        <View style={styles.identity}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{account?.email}</Text>
          {account && (
            <Text style={styles.meta}>
              {[
                account.city || null,
                account.birthMonth && account.birthYear ? `Born ${account.birthMonth} ${account.birthYear}` : null,
                `@${account.userId}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          )}
          {account?.device && <Text style={styles.deviceMeta}>{formatDeviceLabel(account.device)}</Text>}
        </View>

        <View style={styles.list}>
          {ROWS.map((row) => (
            <Pressable key={row.label} style={styles.row} onPress={() => showToast(`${row.label} isn't built in this preview.`)}>
              <View style={styles.rowIcon}>
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                  <Circle cx="12" cy="12" r="8" stroke={colors.navy} strokeWidth={1.8} />
                </Svg>
              </View>
              <Text style={styles.rowLabel}>{row.label}</Text>
              {row.value && <Text style={styles.rowValue}>{row.value}</Text>}
            </Pressable>
          ))}

          <Pressable style={[styles.row, styles.logoutRow]} onPress={confirmLogout}>
            <View style={[styles.rowIcon, styles.logoutIcon]}>
              <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="#EF4444" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={styles.logoutLabel}>Log out</Text>
          </Pressable>
          <Text style={styles.logoutHint}>You'll stay logged in until you log out here — no automatic timeouts.</Text>
        </View>

        <Pressable onPress={checkForUpdateNow} disabled={checkingUpdate} hitSlop={10}>
          <Text style={styles.buildLabel}>
            {checkingUpdate ? "Checking for updates…" : buildLabel() + "  ·  tap to check for updates"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.appBg },
  scrollContent: { alignItems: "center", paddingTop: 24, paddingBottom: 24 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.tealTint,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  avatarPressed: { borderColor: colors.teal },
  avatarText: { fontFamily: fonts.displayBold, fontSize: 26, color: colors.tealDark },
  tapHint: {
    marginTop: 8,
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.muted2,
  },
  idCard: {
    marginTop: 16,
    width: "100%",
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginHorizontal: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    alignItems: "center",
    maxWidth: 340,
  },
  qrWrap: {
    padding: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  idLabel: {
    marginTop: 14,
    fontFamily: fonts.bodySemibold,
    fontSize: 9.5,
    letterSpacing: 1.2,
    color: colors.muted2,
  },
  idValue: {
    marginTop: 4,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy,
    letterSpacing: 1,
  },
  idCaption: {
    marginTop: 10,
    fontFamily: fonts.bodyRegular,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.muted,
    textAlign: "center",
    maxWidth: 240,
  },
  identity: { alignItems: "center", marginTop: 18, marginBottom: 20 },
  name: { fontFamily: fonts.displayBold, fontSize: 17, color: colors.navy },
  email: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.muted2, marginTop: 2 },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.muted2, marginTop: 4 },
  deviceMeta: { fontFamily: fonts.bodyMedium, fontSize: 9.5, color: colors.muted2, marginTop: 2 },
  list: { width: "100%", paddingHorizontal: 20, gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 13,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.appBg,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontFamily: fonts.bodySemibold, fontSize: 12.5, color: colors.navy2 },
  rowValue: { marginLeft: "auto", fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.muted2 },
  logoutRow: { marginTop: 6, borderColor: "#FECACA" },
  logoutIcon: { backgroundColor: "#FEF2F2" },
  logoutLabel: { fontFamily: fonts.bodySemibold, fontSize: 12.5, color: "#EF4444" },
  logoutHint: { marginTop: 8, fontFamily: fonts.bodyRegular, fontSize: 10.5, color: colors.muted2, textAlign: "center" },
  buildLabel: { marginTop: 22, fontFamily: fonts.bodyRegular, fontSize: 9.5, color: colors.muted2, opacity: 0.8, textAlign: "center", textDecorationLine: "underline" },
});
