import React from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { useProfileId } from "@/utils/profileId";

interface Props {
  visible: boolean;
  onClose: () => void;
}

/** Quick-access sheet for your own SnapBill QR — one tap from anywhere, for handing to a checkout. */
export function QuickQrModal({ visible, onClose }: Props) {
  const { id, qrValue } = useProfileId();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>Your SnapBill QR</Text>
          <Text style={styles.subtitle}>Show this at any partner checkout to receive the digital invoice.</Text>

          <View style={styles.qrWrap}>
            {id ? (
              <QRCode value={qrValue} size={176} color={colors.navy} backgroundColor={colors.card} />
            ) : (
              <View style={{ width: 176, height: 176 }} />
            )}
          </View>

          <Text style={styles.idLabel}>YOUR SNAPBILL ID</Text>
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
