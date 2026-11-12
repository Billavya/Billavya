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
          {/* Small header echo of the app icon: three plain "receipt" cells
              and one teal "trending up" cell, top-right — see assets/icon.png
              for the full detailed version this simplifies. */}
          <Svg width={10.5} height={10.5} viewBox="0 0 24 24" fill="none">
            <Rect x="3" y="3" width="8" height="8" rx="1.5" stroke="#FFFFFF" strokeWidth={2} />
            <Rect x="3" y="13" width="8" height="8" rx="1.5" stroke="#FFFFFF" strokeWidth={2} />
            <Rect x="13" y="13" width="8" height="8" rx="1.5" stroke="#FFFFFF" strokeWidth={2} />
            <Rect x="13" y="3" width="8" height="8" rx="1.5" fill={colors.teal} />
            <Path d="M14.8 9.2 17 7l1.4 1.4L20.2 6" stroke="#FFFFFF" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M18.2 6h2v2" stroke="#FFFFFF" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
        <Text style={styles.brandName}>Avyaya</Text>
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
          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
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
    paddingHorizontal: 15,
    paddingTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 6 },
  brandMark: {
    width: 21,
    height: 21,
    borderRadius: 6,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: { fontFamily: fonts.displayBold, fontSize: 13.5, color: colors.navy },
  actions: { flexDirection: "row", alignItems: "center", gap: 7.5 },
  iconBtn: {
    width: 25.5,
    height: 25.5,
    borderRadius: 8.3,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  // Red, not the brand accent — reads as "needs attention" faster than any
  // on-brand color, which is the whole point of a notification badge.
  dot: {
    position: "absolute",
    top: 4.5,
    right: 4.5,
    width: 4.5,
    height: 4.5,
    borderRadius: 2.3,
    backgroundColor: colors.danger,
    borderWidth: 1.1,
    borderColor: colors.card,
  },
  avatar: {
    width: 25.5,
    height: 25.5,
    borderRadius: 8.3,
    backgroundColor: colors.tealTint,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.displayBold, fontSize: 10.9, color: colors.tealDark },
  overlay: { flex: 1, backgroundColor: "rgba(11,37,69,0.35)" },
  panel: {
    position: "absolute",
    top: 72,
    right: 15,
    width: 180,
    backgroundColor: colors.card,
    borderRadius: 10.5,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 6,
    shadowColor: colors.navy,
    shadowOpacity: 0.3,
    shadowRadius: 13.5,
    shadowOffset: { width: 0, height: 7.5 },
    elevation: 8,
  },
  notifItem: { flexDirection: "row", gap: 6, padding: 6, alignItems: "flex-start" },
  ndot: { width: 4.5, height: 4.5, borderRadius: 2.3, backgroundColor: colors.danger, marginTop: 3.8 },
  notifText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 9.4, lineHeight: 13.1, color: colors.navy2 },
  notifFoot: {
    textAlign: "center",
    fontFamily: fonts.bodyMedium,
    fontSize: 8.6,
    color: colors.muted2,
    paddingTop: 4.5,
    paddingBottom: 1.5,
  },
});
