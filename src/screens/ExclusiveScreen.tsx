import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { formatINR } from "@/data/folders";
import { FolderIcon } from "@/components/FolderIcon";
import { InvoiceDetailModal } from "@/components/InvoiceDetailModal";
import { LiveInvoice } from "@/services/invoices";
import { useCombinedInvoices, CombinedInvoice } from "@/hooks/useCombinedInvoices";

export function ExclusiveScreen() {
  const navigation = useNavigation();
  const { invoices, markSeen } = useCombinedInvoices();
  const [open, setOpen] = useState<LiveInvoice | null>(null);

  const exclusive = useMemo(() => invoices.filter((inv) => inv.giftLabel || inv.warranty), [invoices]);

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
          <Text style={styles.subtitle}>
            {exclusive.length} {exclusive.length === 1 ? "invoice" : "invoices"} tagged gift or warranty
          </Text>
        </View>
      </View>

      <FlatList
        data={exclusive}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Nothing here yet — open any invoice and tag it Gift or Warranty to see it collected here.
          </Text>
        }
        renderItem={({ item }: { item: CombinedInvoice }) => {
          const hasCopy = item.live && !!item.detail;
          function handlePress() {
            markSeen(item.key);
            if (item.detail) setOpen(item.detail);
          }
          const row = (
            <View style={styles.row}>
              <View style={styles.icon}>
                <FolderIcon name={item.folder} size={18} color={colors.teal} />
              </View>
              <View style={styles.meta}>
                <Text style={styles.store} numberOfLines={1}>
                  {item.store}
                </Text>
                <View style={styles.badgeRow}>
                  {item.giftLabel && (
                    <View style={[styles.badge, styles.giftBadge]}>
                      <Text style={styles.badgeText}>GIFT</Text>
                    </View>
                  )}
                  {item.warranty && (
                    <View style={[styles.badge, styles.warrantyBadge]}>
                      <Text style={styles.badgeText}>WARRANTY</Text>
                    </View>
                  )}
                  <Text style={styles.sub} numberOfLines={1}>
                    {item.folder} · {item.date}
                  </Text>
                </View>
              </View>
              <Text style={styles.amount}>{formatINR(item.amount)}</Text>
            </View>
          );
          return hasCopy ? <Pressable onPress={handlePress}>{row}</Pressable> : row;
        }}
      />

      <InvoiceDetailModal invoice={open} onClose={() => setOpen(null)} />
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
  subtitle: { marginTop: 2, fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.navy2 },
  listContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 12,
  },
  icon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" },
  meta: { flex: 1, minWidth: 0 },
  store: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.navy2 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  badge: { paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 999 },
  giftBadge: { backgroundColor: "#FDE68A" },
  warrantyBadge: { backgroundColor: colors.tealTint },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 7.5, color: colors.navy2, letterSpacing: 0.4 },
  sub: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.muted2, flexShrink: 1 },
  amount: { fontFamily: fonts.displayBold, fontSize: 12, color: colors.navy },
  empty: { textAlign: "center", marginTop: 24, fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted2 },
});
