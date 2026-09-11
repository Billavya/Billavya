import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function ScanModal({ visible, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.icon}>
            <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
              <Rect x="3" y="3" width="7" height="7" rx="1.2" stroke={colors.tealDark} strokeWidth={2} />
              <Rect x="14" y="3" width="7" height="7" rx="1.2" stroke={colors.tealDark} strokeWidth={2} />
              <Rect x="3" y="14" width="7" height="7" rx="1.2" stroke={colors.tealDark} strokeWidth={2} />
              <Path d="M15 15h2.5M15 19h6M20 15v6" stroke={colors.tealDark} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </View>
          <Text style={styles.title}>Scan a receipt</Text>
          <Text style={styles.body}>
            Camera capture isn't wired up in this preview — a real build would open the camera here and auto-file
            the invoice into a folder.
          </Text>
          <Pressable style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Got it</Text>
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
    paddingTop: 22,
    paddingBottom: 34,
    alignItems: "center",
  },
  icon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.tealTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.navy, marginBottom: 6 },
  body: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.muted,
    textAlign: "center",
    marginBottom: 18,
  },
  button: {
    width: "100%",
    paddingVertical: 13,
    borderRadius: 13,
    backgroundColor: colors.navy,
    alignItems: "center",
  },
  buttonText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: "#fff" },
});
