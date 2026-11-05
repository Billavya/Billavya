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

  // Folders with at least one real (POS-pushed) invoice in the last 90 days —
  // used below to push folders nobody's actually used lately to the bottom
  // of the grid, independent of whatever sort mode is currently selected.
  // Only live invoices carry an exact timestamp to check, same convention as
  // last30Count below.
  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
  const recentFolderNames = useMemo(() => {
    const cutoff = Date.now() - NINETY_DAYS_MS;
    const set = new Set<string>();
    for (const inv of invoices) {
      if (inv.live && inv.detail && !inv.transferredTo && inv.detail.createdAtMs >= cutoff) {
        set.add(inv.folder);
      }
    }
    return set;
  }, [invoices]);

  const folders = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = allFolders.filter((f) => f.name.toLowerCase().includes(q));
    const cmp = SORTS[sortIndex].cmp;
    if (cmp) list = [...list].sort(cmp);
    // Stable partition on top of whatever order is above: folders used in
    // the last 90 days stay first (keeping their relative order), everything
    // else sinks to the bottom (also keeping its relative order).
    list = [...list].sort((a, b) => {
      const aRecent = recentFolderNames.has(a.name) ? 0 : 1;
      const bRecent = recentFolderNames.has(b.name) ? 0 : 1;
      return aRecent - bRecent;
    });
    return list;
  }, [allFolders, query, sortIndex, recentFolderNames]);

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
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
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
                <Svg width={15.73} height={15.73} viewBox="0 0 24 24" fill="none">
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
              <Svg width={11.55} height={11.55} viewBox="0 0 24 24" fill="none">
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
  greeting: { paddingHorizontal: 15, paddingTop: 9 },
  greetingTitle: { fontFamily: fonts.displayBold, fontSize: 16.1, color: colors.navy },
  greetingSub: { fontFamily: fonts.bodyRegular, fontSize: 10.1, color: colors.muted, marginTop: 1.5 },
  searchRow: { flexDirection: "row", gap: 6, paddingHorizontal: 15, marginTop: 9 },
  sortBtn: {
    width: 30,
    height: 30,
    borderRadius: 9.8,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    marginTop: 12,
    marginBottom: 4.5,
  },
  sectionTitle: { fontFamily: fonts.displayBold, fontSize: 12, color: colors.navy },
  sectionCount: { fontFamily: fonts.bodyMedium, fontSize: 9, color: colors.muted2 },
  // Sizes below are the original "Latest Bills" pinned-card values scaled
  // up 10% (not a fresh redesign) — same proportions, just larger.
  pinnedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9.9,
    marginHorizontal: 15,
    marginTop: 12,
    padding: 11.55,
    backgroundColor: colors.navy,
    borderRadius: 13.2,
    shadowColor: colors.navy,
    shadowOpacity: 0.3,
    shadowRadius: 9.9,
    shadowOffset: { width: 0, height: 4.95 },
  },
  pinnedIconWrap: {
    width: 33,
    height: 33,
    borderRadius: 9.9,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  pinnedMeta: { flex: 1, minWidth: 0 },
  pinnedTitle: { fontFamily: fonts.displayBold, fontSize: 12.43, color: "#fff" },
  pinnedSub: { marginTop: 1.65, fontFamily: fonts.bodyMedium, fontSize: 9.46, color: "rgba(255,255,255,0.7)" },
  // paddingTop clears room for FolderCard's spotlightBadge (top: -7
  // relative to its card) on the top row — same overlap bug fixed in
  // FolderDetailScreen's colBody: the badge pokes above the card, and with
  // no gap above the first row it collided with "Your Folders" above it.
  gridContent: { paddingHorizontal: 15, paddingTop: 8, paddingBottom: 12, gap: 6 },
  gridRow: { gap: 6 },
  empty: { textAlign: "center", marginTop: 18, fontFamily: fonts.bodyMedium, fontSize: 9.8, color: colors.muted2 },
});
