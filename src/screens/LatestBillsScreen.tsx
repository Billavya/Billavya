import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function LatestBillsScreen() {
  const navigation = useNavigation();
  const { invoices, markSeen } = useCombinedInvoices();
  const [open, setOpen] = useState<LiveInvoice | null>(null);

  const bills = useMemo(() => {
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    return invoices
      .filter(
        (inv): inv is CombinedInvoice & { detail: LiveInvoice } =>
          !!inv.live && !!inv.detail && !inv.transferredTo && inv.detail.createdAtMs >= cutoff
      )
      .sort((a, b) => b.detail.createdAtMs - a.detail.createdAtMs);
  }, [invoices]);

  const total = useMemo(() => bills.reduce((s, inv) => s + inv.amount, 0), [bills]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M15 5 8 12l7 7" stroke={colors.navy} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Latest Bills</Text>
          <Text style={styles.subtitle}>
            Last 30 days · {bills.length} invoice{bills.length === 1 ? "" : "s"} · {formatINR(total)} total
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {bills.length === 0 && <Text style={styles.emptyNote}>No invoices in the last 30 days yet.</Text>}
        {bills.map((inv) => (
          <Pressable
            key={inv.key}
            style={styles.row}
            onPress={() => {
              markSeen(inv.key);
              setOpen(inv.detail);
            }}
          >
            <View style={styles.icon}>
              <FolderIcon name={inv.folder} size={16} color={colors.gold} />
            </View>
            <View style={styles.meta}>
              <Text style={styles.store} numberOfLines={1}>
                {inv.store}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {inv.folder} · {inv.date}
              </Text>
            </View>
            {inv.unseen && <View style={styles.newDot} />}
            <Text style={styles.amount}>{formatINR(inv.amount)}</Text>
          </Pressable>
        ))}
      </ScrollView>

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
  titleWrap: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.navy },
  subtitle: { marginTop: 2, fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.navy2 },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 9 },
  row: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 12,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  meta: { flex: 1, minWidth: 0 },
  store: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.navy2 },
  sub: { marginTop: 2, fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.muted2 },
  newDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.green },
  amount: { fontFamily: fonts.displayBold, fontSize: 14, color: colors.navy },
  emptyNote: { textAlign: "center", marginTop: 40, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.muted2 },
});
