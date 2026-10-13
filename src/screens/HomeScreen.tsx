import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { AppHeader } from "@/components/AppHeader";
import { StatStrip } from "@/components/StatStrip";
import { FolderCard } from "@/components/FolderCard";
import { SearchField } from "@/components/SearchField";
import { Folder, formatINR } from "@/data/folders";
import { useToast } from "@/components/Toast";
import { useCombinedInvoices, CombinedInvoice } from "@/hooks/useCombinedInvoices";
import { useAccount } from "@/utils/account";
import { LiveInvoice } from "@/services/invoices";
import { LOCALE } from "@/config/locale";
import { useActiveSpotlights } from "@/hooks/useActiveSpotlights";

type SortKey = "default" | "amount" | "count" | "az";
const SORTS: { key: SortKey; label: string; cmp: ((a: Folder, b: Folder) => number) | null }[] = [
  { key: "default", label: "Default order", cmp: null },
  { key: "amount", label: "Sorted by highest spend", cmp: (a, b) => b.amount - a.amount },
  { key: "count", label: "Sorted by most invoices", cmp: (a, b) => b.count - a.count },
  { key: "az", label: "Sorted A to Z", cmp: (a, b) => a.name.localeCompare(b.name) },
];

export function HomeScreen() {
  const navigation = useNavigation<any>();
  const { showToast } = useToast();
  const [query, setQuery] = useState("");
  const [sortIndex, setSortIndex] = useState(0);

  const { folders: allFolders, currentMonthCount, currentMonthAmount, trendPercent, invoices } = useCombinedInvoices();
  const { account } = useAccount();
  const name = account?.firstName ?? "there";

  const activeSpotlights = useActiveSpotlights();

  const folders = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = allFolders.filter((f) => f.name.toLowerCase().includes(q));
    const cmp = SORTS[sortIndex].cmp;
    if (cmp) list = [...list].sort(cmp);
    return list;
  }, [allFolders, query, sortIndex]);

  // Count for the pinned "Latest Bills" folder tile below — the full list
  // itself lives on its own screen (LatestBillsScreen), which subscribes
  // independently, same pattern as FolderDetailScreen. Only live invoices
  // (pushed by a real POS) carry an exact timestamp (createdAtMs) to filter
  // by; transferred invoices are excluded, same as every other total here.
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const last30Count = useMemo(() => {
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    return invoices.filter(
      (inv): inv is CombinedInvoice & { detail: LiveInvoice } =>
        !!inv.live && !!inv.detail && !inv.transferredTo && inv.detail.createdAtMs >= cutoff
    ).length;
  }, [invoices]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <AppHeader />

      <FlatList
        data={folders}
        keyExtractor={(item) => item.name}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        ListEmptyComponent={<Text style={styles.empty}>No folders match "{query}".</Text>}
        renderItem={({ item }) => {
          const spot = activeSpotlights.find((s) => s.category === item.name);
          return (
            <FolderCard
              folder={item}
              onPress={() => navigation.navigate("FolderDetail", { folderName: item.name })}
              spotlight={spot ? { badgeLabel: spot.badgeLabel } : undefined}
            />
          );
        }}
        ListHeaderComponent={
          <>
            <View style={styles.greeting}>
              <Text style={styles.greetingTitle}>Hi, {name ?? "there"}</Text>
              <Text style={styles.greetingSub}>Here's your spending, organized by folder.</Text>
            </View>

            <StatStrip
              invoiceCount={currentMonthCount}
              totalTracked={formatINR(currentMonthAmount)}
              totalTrackedMasked={`${LOCALE.currencySymbol}••,•••`}
              monthLabel={new Date().toLocaleString("en-US", { month: "short" })}
              trendPercent={trendPercent}
            />

            <View style={styles.searchRow}>
              <SearchField value={query} onChangeText={setQuery} placeholder="Search invoices, stores…" />
              <Pressable
                style={styles.sortBtn}
                accessibilityLabel="Change folder sort order"
                onPress={() => {
                  const next = (sortIndex + 1) % SORTS.length;
                  setSortIndex(next);
                  showToast(SORTS[next].label);
                }}
              >
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M7 4v16M7 4 3.5 7.5M7 4l3.5 3.5M17 20V4M17 20l3.5-3.5M17 20l-3.5-3.5"
                    stroke="#fff"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </Pressable>
            </View>

            <Pressable style={styles.pinnedCard} onPress={() => navigation.navigate("LatestBills")}>
              <View style={styles.pinnedIconWrap}>
                <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
                  <Circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth={2} />
                  <Path d="M12 7v5l3.5 2" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <View style={styles.pinnedMeta}>
                <Text style={styles.pinnedTitle}>Latest Bills</Text>
                <Text style={styles.pinnedSub}>
                  Last 30 days · {last30Count} invoice{last30Count === 1 ? "" : "s"}
                </Text>
              </View>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="m9 6 6 6-6 6" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>

            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Your Folders</Text>
              <Text style={styles.sectionCount}>
                {query ? `${folders.length} of ${allFolders.length}` : `${allFolders.length} folders`}
              </Text>
            </View>
          </>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.appBg },
  greeting: { paddingHorizontal: 20, paddingTop: 12 },
  greetingTitle: { fontFamily: fonts.displayBold, fontSize: 21.5, color: colors.navy },
  greetingSub: { fontFamily: fonts.bodyRegular, fontSize: 13.5, color: colors.muted, marginTop: 2 },
  searchRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, marginTop: 12 },
  sortBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 6,
  },
  sectionTitle: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.navy },
  sectionCount: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted2 },
  pinnedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 14,
    backgroundColor: colors.navy,
    borderRadius: 16,
    shadowColor: colors.navy,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  pinnedIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  pinnedMeta: { flex: 1, minWidth: 0 },
  pinnedTitle: { fontFamily: fonts.displayBold, fontSize: 15, color: "#fff" },
  pinnedSub: { marginTop: 2, fontFamily: fonts.bodyMedium, fontSize: 11.5, color: "rgba(255,255,255,0.7)" },
  gridContent: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
  gridRow: { gap: 8 },
  empty: { textAlign: "center", marginTop: 24, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.muted2 },
});
