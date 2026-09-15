import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { useCombinedInvoices } from "@/hooks/useCombinedInvoices";

export type ExclusiveKind = "gift" | "warranty" | "transferred" | "received" | "other";

export const EXCLUSIVE_KINDS: {
  kind: ExclusiveKind;
  name: string;
  blurb: string;
  bg: string;
  border: string;
  icon: (color: string) => React.ReactNode;
}[] = [
  {
    kind: "gift",
    name: "Gifts",
    blurb: "Invoices tagged as a gift for someone",
    bg: "#FFFBEB",
    border: "#FDE68A",
    icon: (c) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Rect x="3.5" y="9" width="17" height="10" rx="1.2" stroke={c} strokeWidth={1.8} />
        <Rect x="3.5" y="6" width="17" height="4" rx="1" stroke={c} strokeWidth={1.8} />
        <Path d="M12 6v13" stroke={c} strokeWidth={1.8} />
        <Path d="M12 6c-1.5-3-5-3-5-.5S9.5 6 12 6ZM12 6c1.5-3 5-3 5-.5S14.5 6 12 6Z" stroke={c} strokeWidth={1.6} strokeLinejoin="round" />
      </Svg>
    ),
  },
  {
    kind: "warranty",
    name: "Warranty",
    blurb: "Products covered by a warranty",
    bg: colors.tealTint,
    border: colors.teal,
    icon: (c) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M12 3 5 6v5c0 4.2 3 7.5 7 9 4-1.5 7-4.8 7-9V6l-7-3Z" stroke={c} strokeWidth={1.8} strokeLinejoin="round" />
        <Path d="M9 12l2 2 4-4" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
  {
    kind: "transferred",
    name: "Transferred",
    blurb: "Invoices you've handed off to someone",
    bg: "#FEF2F2",
    border: "#FECACA",
    icon: (c) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M4 12h12M12 6l6 6-6 6" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
  {
    kind: "received",
    name: "Received",
    blurb: "Invoices someone transferred to you",
    bg: "#EAF1FF",
    border: "#BFDBFE",
    icon: (c) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M20 12H8M14 6l-6 6 6 6" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
  {
    kind: "other",
    name: "Others",
    blurb: "Anything else worth keeping separate",
    bg: colors.appBg,
    border: colors.line,
    icon: (c) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M11 4H5a1 1 0 0 0-1 1v6l9 9 7-7-9-9Z" stroke={c} strokeWidth={1.8} strokeLinejoin="round" />
        <Circle cx="7.5" cy="7.5" r="1.2" fill={c} />
      </Svg>
    ),
  },
];

export function ExclusiveScreen() {
  const navigation = useNavigation<any>();
  const { invoices } = useCombinedInvoices();

  const counts = useMemo(() => {
    const c: Record<ExclusiveKind, number> = { gift: 0, warranty: 0, transferred: 0, received: 0, other: 0 };
    for (const inv of invoices) {
      if (inv.giftLabel) c.gift++;
      if (inv.warranty) c.warranty++;
      if (inv.transferredTo) c.transferred++;
      if (inv.otherLabel) c.other++;
    }
    return c;
  }, [invoices]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M15 5 8 12l7 7" stroke={colors.navy} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <View style={styles.badgeIcon}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="m12 3 2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L12 17l-5.6 3.1 1.4-6.3-4.8-4.3 6.4-.6L12 3Z" stroke={colors.navy} strokeWidth={1.8} strokeLinejoin="round" />
          </Svg>
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Exclusive</Text>
          <Text style={styles.subtitle}>Gifts, warranties, and handed-off invoices — from every category</Text>
        </View>
      </View>

      <View style={styles.list}>
        {EXCLUSIVE_KINDS.map((k) => (
          <Pressable
            key={k.kind}
            style={[styles.row, { backgroundColor: k.bg, borderColor: k.border }]}
            onPress={() => navigation.navigate("ExclusiveDetail", { kind: k.kind })}
          >
            <View style={[styles.icon, { borderColor: k.border }]}>{k.icon(colors.navy)}</View>
            <View style={styles.meta}>
              <Text style={styles.name}>{k.name}</Text>
              <Text style={styles.blurb}>{k.blurb}</Text>
            </View>
            {counts[k.kind] > 0 && (
              <View style={styles.countPill}>
                <Text style={styles.countText}>{counts[k.kind]}</Text>
              </View>
            )}
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.appBg },
  header: { paddingHorizontal: 20, paddingTop: 4, flexDirection: "row", alignItems: "center", gap: 11 },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#FEF3C7", alignItems: "center", justifyContent: "center" },
  titleWrap: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.navy },
  subtitle: { marginTop: 2, fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.navy2 },
  list: { padding: 20, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.card,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  meta: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.displaySemibold, fontSize: 14.5, color: colors.navy },
  blurb: { marginTop: 2, fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.navy2 },
  countPill: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  countText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.navy },
  chevron: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.navy2 },
});
