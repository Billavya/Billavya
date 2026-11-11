import React, { useEffect, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { useProfileId } from "@/utils/profileId";
import { useDynamicQr, formatRemaining, REFRESH_LEAD_MS } from "@/utils/dynamicQr";
import { useAccount } from "@/utils/account";

interface Props {
  visible: boolean;
  onClose: () => void;
}

/** Quick-access sheet for your own Avyaya QR — one tap from anywhere, for handing to a checkout. */
export function QuickQrModal({ visible, onClose }: Props) {
  const { id, qrValue } = useProfileId();
  const { account } = useAccount();
  // 34 was a guessed constant matching typical notched-iPhone home-indicator
  // insets — replaced with the device's real value so it's correct on every
  // device instead of by coincidence on some of them.
  const insets = useSafeAreaInsets();

  // Only asks the backend when the sheet is open AND the account opted in —
  // the backend re-checks the flag itself, this just avoids pointless calls.
  const dynamic = useDynamicQr(visible && !!account?.dynamicQr);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!dynamic) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [dynamic]);

  const shownValue = dynamic?.qrValue ?? qrValue;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: 22 + insets.bottom }]} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>Your Avyaya QR</Text>
          <Text style={styles.subtitle}>Show this at any partner checkout to receive the digital invoice.</Text>

          <View style={styles.qrWrap}>
            {id ? (
              <QRCode value={shownValue} size={176} color={colors.navy} backgroundColor={colors.card} />
            ) : (
              <View style={{ width: 176, height: 176 }} />
            )}
          </View>

          {dynamic && (
            <Text style={styles.dynamicNote}>
              Dynamic code · refreshes in {formatRemaining(dynamic.expiresAtMs - REFRESH_LEAD_MS - now)}
            </Text>
          )}

          <Text style={styles.idLabel}>YOUR AVYAYA ID</Text>
          <Text style={styles.idValue}>{id ?? "Generating…"}</Text>

          <Pressable style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(11,37,69,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 34,
    alignItems: "center",
  },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 14 },
  title: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.navy },
  subtitle: {
    marginTop: 4,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    textAlign: "center",
    maxWidth: 260,
  },
  qrWrap: {
    marginTop: 18,
    padding: 14,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  dynamicNote: { marginTop: 10, fontFamily: fonts.bodySemibold, fontSize: 11, color: colors.tealDark },
  idLabel: { marginTop: 16, fontFamily: fonts.bodySemibold, fontSize: 10, letterSpacing: 1.2, color: colors.muted2 },
  idValue: {
    marginTop: 4,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    fontSize: 19,
    fontWeight: "700",
    color: colors.navy,
    letterSpacing: 1,
  },
  button: {
    marginTop: 20,
    width: "100%",
    paddingVertical: 13,
    borderRadius: 13,
    backgroundColor: colors.navy,
    alignItems: "center",
  },
  buttonText: { fontFamily: fonts.bodySemibold, fontSize: 14.5, color: "#fff" },
});
