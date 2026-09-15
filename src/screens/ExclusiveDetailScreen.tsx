import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { formatINR } from "@/data/folders";
import { InvoiceDetailModal } from "@/components/InvoiceDetailModal";
import { LiveInvoice } from "@/services/invoices";
import { useCombinedInvoices, CombinedInvoice } from "@/hooks/useCombinedInvoices";
import { EXCLUSIVE_KINDS, ExclusiveKind } from "@/screens/ExclusiveScreen";

const EMPTY_COPY: Record<ExclusiveKind, string> = {
  gift: "Nothing here yet. Open any invoice and tap the Gift tag to collect it here.",
  warranty: "Nothing here yet. Open any invoice and tap the Warranty tag to collect it here.",
  transferred: "Nothing here yet. Invoices you hand off from the Transfer button will show up here.",
  received: "Nothing here yet. This fills up when another SnapBill user transfers an invoice to you — account-to-account transfers aren't wired up in this preview, only handing one away is.",
  other: "Nothing here yet. Open any invoice and tap the Other tag to collect it here.",
};

export function ExclusiveDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const kind: ExclusiveKind = route.params?.kind;
  const info = EXCLUSIVE_KINDS.find((k) => k.kind === kind)!;

  const { invoices, markSeen } = useCombinedInvoices();
  const [open, setOpen] = useState<LiveInvoice | null>(null);

  const filtered = useMemo(() => {
    if (kind === "received") return [];
    return invoices.filter((inv) => {
      if (kind === "gift") return !!inv.giftLabel;
      if (kind === "warranty") return !!inv.warranty;
      if (kind === "transferred") return !!inv.transferredTo;
      if (kind === "other") return !!inv.otherLabel;
      return false;
    });
  }, [invoices, kind]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back to Exclusive">
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M15 5 8 12l7 7" stroke={colors.navy} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <View style={[styles.icon, { backgroundColor: info.bg, borderColor: info.border }]}>{info.icon(colors.navy)}</View>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{info.name}</Text>
          <Text style={styles.subtitle}>
            {filtered.length} {filtered.length === 1 ? "invoice" : "invoices"}
          </Text>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={<Text style={styles.empty}>{EMPTY_COPY[kind]}</Text>}
        renderItem={({ item }: { item: CombinedInvoice }) => {
          const hasCopy = item.live && !!item.detail;
          const transferred = kind === "transferred" && !!item.transferredTo;
          function handlePress() {
            markSeen(item.key);
            if (item.detail) setOpen(item.detail);
          }
          const row = (
            <View style={[styles.row, { borderColor: info.border, backgroundColor: info.bg }]}>
              <View style={styles.meta}>
                <Text style={styles.store} numberOfLines={1}>
                  {item.store}
                </Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {item.folder} · {item.date}
                  {transferred ? ` · to ${item.transferredTo}` : ""}
                </Text>
              </View>
              <Text style={[styles.amount, transferred && styles.amountNegative]}>
                {transferred ? "−" : ""}
                {formatINR(item.amount)}
              </Text>
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
  icon: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  titleWrap: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.navy },
  subtitle: { marginTop: 2, fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.navy2 },
  listContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 11, borderWidth: 1, borderRadius: 14, padding: 12 },
  meta: { flex: 1, minWidth: 0 },
  store: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.navy2 },
  sub: { marginTop: 2, fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.muted2 },
  amount: { fontFamily: fonts.displayBold, fontSize: 12, color: colors.navy },
  amountNegative: { color: "#B91C1C" },
  empty: { textAlign: "center", marginTop: 24, fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 18, color: colors.muted2 },
});
