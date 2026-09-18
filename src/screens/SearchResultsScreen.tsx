import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { formatINR } from "@/data/folders";
import { FolderIcon } from "@/components/FolderIcon";
import { InvoiceDetailModal } from "@/components/InvoiceDetailModal";
import { LiveInvoice } from "@/services/invoices";
import { useCombinedInvoices, CombinedInvoice } from "@/hooks/useCombinedInvoices";

export function SearchResultsScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const query: string = route.params?.query ?? "";
  const categories: string[] = route.params?.categories ?? [];
  const city: string | null = route.params?.city ?? null;

  const { invoices, markSeen } = useCombinedInvoices();
  const [open, setOpen] = useState<LiveInvoice | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (categories.length && !categories.includes(inv.folder)) return false;
      if (city && inv.location !== city) return false;
      if (!q) return true;
      return inv.store.toLowerCase().includes(q) || inv.folder.toLowerCase().includes(q);
    });
  }, [invoices, query, categories, city]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back to search">
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M15 5 8 12l7 7" stroke={colors.navy} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <View>
          <Text style={styles.title}>Results</Text>
          <Text style={styles.subtitle}>
            {results.length} {results.length === 1 ? "invoice matches" : "invoices match"}
            {city ? ` in ${city}` : ""}
          </Text>
        </View>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={<Text style={styles.empty}>No invoices match your filters.</Text>}
        renderItem={({ item }: { item: CombinedInvoice }) => {
          const hasCopy = item.live && !!item.detail;
          const transferred = !!item.transferredTo;
          const row = (
            <View style={[styles.row, item.live && styles.rowLive, transferred && styles.rowTransferred]}>
              <View style={styles.icon}>
                <FolderIcon name={item.folder} size={18} color={colors.teal} />
              </View>
              <View style={styles.meta}>
                <View style={styles.storeRow}>
                  <Text style={styles.store} numberOfLines={1}>
                    {item.store}
                  </Text>
                  {transferred ? (
                    <View style={styles.transferTag}>
                      <Text style={styles.transferTagText}>TRANSFERRED</Text>
                    </View>
                  ) : (
                    item.live &&
                    item.unseen && (
                      <View style={styles.newTag}>
                        <Text style={styles.newTagText}>NEW</Text>
                      </View>
                    )
                  )}
                  {item.favorite && !transferred && (
                    <Svg width={11} height={11} viewBox="0 0 24 24" fill={colors.teal}>
                      <Path d="m12 3 2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L12 17l-5.6 3.1 1.4-6.3-4.8-4.3 6.4-.6L12 3Z" />
                    </Svg>
                  )}
                </View>
                <Text style={styles.sub} numberOfLines={1}>
                  {item.folder} · {item.location} · {item.date}
                </Text>
                {transferred ? (
                  <Text style={styles.transferToHint}>To {item.transferredTo}</Text>
                ) : (
                  hasCopy && <Text style={styles.tapHint}>Tap to open digital copy</Text>
                )}
              </View>
              <Text style={[styles.amount, transferred && styles.amountNegative]}>
                {transferred ? "−" : ""}
                {formatINR(item.amount)}
              </Text>
            </View>
          );
          function handlePress() {
            markSeen(item.key);
            if (item.detail) setOpen(item.detail);
          }
          return hasCopy ? <Pressable onPress={handlePress}>{row}</Pressable> : row;
        }}
      />

      <InvoiceDetailModal invoice={open} onClose={() => setOpen(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.appBg },
  header: { paddingHorizontal: 20, paddingTop: 12, flexDirection: "row", alignItems: "center", gap: 11 },
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
  title: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.navy },
  subtitle: { marginTop: 2, fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted },
  listContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
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
  rowLive: { borderColor: colors.teal, backgroundColor: colors.tealTint },
  rowTransferred: { borderColor: "#FECACA", backgroundColor: "#FEF2F2" },
  transferTag: { backgroundColor: "#EF4444", paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 999 },
  transferTagText: { fontFamily: fonts.bodyBold, fontSize: 8, color: "#fff", letterSpacing: 0.4 },
  transferToHint: { marginTop: 3, fontFamily: fonts.bodySemibold, fontSize: 10, color: "#B91C1C" },
  amountNegative: { color: "#B91C1C" },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  meta: { flex: 1, minWidth: 0 },
  storeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  store: { flexShrink: 1, fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.navy2 },
  newTag: { backgroundColor: colors.teal, paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 999 },
  newTagText: { fontFamily: fonts.bodyBold, fontSize: 8, color: "#fff", letterSpacing: 0.4 },
  sub: { marginTop: 2, fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted2 },
  tapHint: { marginTop: 3, fontFamily: fonts.bodySemibold, fontSize: 10, color: colors.tealDark },
  amount: { fontFamily: fonts.displayBold, fontSize: 13, color: colors.navy },
  empty: { textAlign: "center", marginTop: 24, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.muted2 },
});
