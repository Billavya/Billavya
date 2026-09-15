import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { useNavigation } from "@react-navigation/native";
import { useAccount } from "@/utils/account";

const NOTIFICATIONS = [
  "A new invoice was filed into your Food folder.",
  "Your weekly spending summary is ready.",
];

export function AppHeader() {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);
  const navigation = useNavigation<any>();
  const { account } = useAccount();

  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <View style={styles.brandMark}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Rect x="3" y="3" width="8" height="8" rx="1.5" stroke="#FFFFFF" strokeWidth={2} />
            <Rect x="13" y="3" width="8" height="8" rx="1.5" stroke="#FFFFFF" strokeWidth={2} />
            <Rect x="3" y="13" width="8" height="8" rx="1.5" stroke="#FFFFFF" strokeWidth={2} />
            <Path d="M15 17h6M18 14v6" stroke={colors.teal} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </View>
        <Text style={styles.brandName}>SnapBill</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={styles.iconBtn}
          accessibilityLabel="Notifications"
          onPress={() => {
            setOpen(true);
            setSeen(true);
          }}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M6 10a6 6 0 1 1 12 0c0 3.2 1 5 2 6H4c1-1 2-2.8 2-6Z" stroke={colors.navy} strokeWidth={1.8} strokeLinejoin="round" />
            <Path d="M10 19a2.2 2.2 0 0 0 4 0" stroke={colors.navy} strokeWidth={1.8} strokeLinecap="round" />
          </Svg>
          {!seen && <View style={styles.dot} />}
        </Pressable>
        <Pressable style={styles.avatar} accessibilityLabel="Open profile" onPress={() => navigation.navigate("Profile")}>
          <Text style={styles.avatarText}>{account?.firstName?.[0]?.toUpperCase() ?? "?"}</Text>
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={styles.panel}>
            {NOTIFICATIONS.map((n) => (
              <View key={n} style={styles.notifItem}>
                <View style={styles.ndot} />
                <Text style={styles.notifText}>{n}</Text>
              </View>
            ))}
            <Text style={styles.notifFoot}>You're all caught up</Text>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.navy },
  actions: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.teal,
    borderWidth: 1.5,
    borderColor: colors.card,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.tealTint,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.displayBold, fontSize: 13, color: colors.tealDark },
  overlay: { flex: 1, backgroundColor: "rgba(11,37,69,0.35)" },
  panel: {
    position: "absolute",
    top: 96,
    right: 20,
    width: 240,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 8,
    shadowColor: colors.navy,
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  notifItem: { flexDirection: "row", gap: 8, padding: 8, alignItems: "flex-start" },
  ndot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.teal, marginTop: 5 },
  notifText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 11.5, lineHeight: 15.5, color: colors.navy2 },
  notifFoot: {
    textAlign: "center",
    fontFamily: fonts.bodyMedium,
    fontSize: 10.5,
    color: colors.muted2,
    paddingTop: 6,
    paddingBottom: 2,
  },
});
