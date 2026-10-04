import React, { useState } from "react";
import { Alert, LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, Text, UIManager, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { useToast } from "@/components/Toast";
import { useProfileId } from "@/utils/profileId";
import { useAccount } from "@/utils/account";
import { formatDeviceLabel } from "@/utils/device";
import { buildLabel, useUpdateCheck } from "@/utils/updateCheck";
import { CountryPickerModal } from "@/components/CountryPickerModal";
import { useLocaleCountry } from "@/config/locale";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** "ksphanindra@gmail.com" -> "ks*********@gmail.com" — keeps the domain
 *  (useful to recognize the account at a glance) but hides the rest of the
 *  local part so a shoulder-surfer can't read the full address straight off
 *  this screen. The real email still appears in the Log out confirmation,
 *  where showing it is the whole point. */
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const visible = local.slice(0, 2);
  const hiddenCount = Math.max(local.length - visible.length, 3);
  return visible + "*".repeat(hiddenCount) + domain;
}

const TOP_ROWS: { label: string; value?: string }[] = [
  { label: "Account details" },
  { label: "Notifications" },
];
const BOTTOM_ROWS: { label: string; value?: string }[] = [
  { label: "Appearance", value: "Light" },
  { label: "Export & backup" },
  { label: "Help & support" },
];

const FLAG: Record<string, string> = { India: "🇮🇳", Canada: "🇨🇦" };

export function ProfileScreen() {
  const { showToast } = useToast();
  const { id, qrValue } = useProfileId();
  const { account, setCountry, logout } = useAccount();
  const [showId, setShowId] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const activeCountry = useLocaleCountry();
  const { checking: checkingUpdate, checkForUpdateNow: runUpdateCheck } = useUpdateCheck();

  function checkForUpdateNow() {
    return runUpdateCheck(() => showToast("Update found — restarting…"));
  }
  const displayName = account ? `${account.firstName} ${account.lastName}` : "Generating…";
  const initial = account?.firstName?.[0]?.toUpperCase() ?? "?";

  function toggleId() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowId((v) => !v);
  }

  function selectCountry(country: Parameters<typeof setCountry>[0]) {
    setShowCountryPicker(false);
    if (country === activeCountry) return;
    setCountry(country);
    showToast(`Switched to ${country}`);
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
          accessibilityLabel={showId ? "Hide your Avyaya ID" : "Show your Avyaya ID"}
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
            <Text style={styles.idLabel}>YOUR AVYAYA ID</Text>
            <Text style={styles.idValue}>{id ?? "Generating…"}</Text>
            <Text style={styles.idCaption}>Unique to this profile — show it to link invoices at partner checkouts.</Text>
          </View>
        )}

        <View style={styles.identity}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{account?.email ? maskEmail(account.email) : ""}</Text>
          {account?.city && <Text style={styles.meta}>{account.city}</Text>}
          {account?.device && <Text style={styles.deviceMeta}>{formatDeviceLabel(account.device)}</Text>}
        </View>

        <View style={styles.list}>
          {TOP_ROWS.map((row) => (
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

          <Pressable style={styles.row} onPress={() => setShowCountryPicker(true)}>
            <View style={styles.rowIcon}>
              <Text style={styles.rowFlag}>{FLAG[activeCountry]}</Text>
            </View>
            <Text style={styles.rowLabel}>Country / Region</Text>
            <Text style={styles.rowValue}>{activeCountry}</Text>
          </Pressable>

          {BOTTOM_ROWS.map((row) => (
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
                <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke={colors.dangerBright} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
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

      <CountryPickerModal
        visible={showCountryPicker}
        current={activeCountry}
        onClose={() => setShowCountryPicker(false)}
        onSelect={selectCountry}
      />
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
  avatarText: { fontFamily: fonts.displayBold, fontSize: 29.5, color: colors.tealDark },
  tapHint: {
    marginTop: 8,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
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
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.muted2,
  },
  idValue: {
    marginTop: 4,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    fontSize: 18,
    fontWeight: "700",
    color: colors.navy,
    letterSpacing: 1,
  },
  idCaption: {
    marginTop: 10,
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.muted,
    textAlign: "center",
    maxWidth: 240,
  },
  identity: { alignItems: "center", marginTop: 18, marginBottom: 20 },
  name: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.navy },
  email: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.muted2, marginTop: 2 },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.muted2, marginTop: 4 },
  deviceMeta: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.muted2, marginTop: 2 },
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
  rowLabel: { fontFamily: fonts.bodySemibold, fontSize: 13.5, color: colors.navy2 },
  rowFlag: { fontSize: 16 },
  rowValue: { marginLeft: "auto", fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.muted2 },
  logoutRow: { marginTop: 6, borderColor: colors.dangerLine },
  logoutIcon: { backgroundColor: colors.dangerTint },
  logoutLabel: { fontFamily: fonts.bodySemibold, fontSize: 13.5, color: colors.dangerBright },
  logoutHint: { marginTop: 8, fontFamily: fonts.bodyRegular, fontSize: 11.5, color: colors.muted2, textAlign: "center" },
  buildLabel: { marginTop: 22, fontFamily: fonts.bodyRegular, fontSize: 10, color: colors.muted2, opacity: 0.8, textAlign: "center", textDecorationLine: "underline" },
});
