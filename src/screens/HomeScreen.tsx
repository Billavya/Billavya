import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { AppHeader } from "@/components/AppHeader";
import { StatStrip } from "@/components/StatStrip";
import { FolderCard } from "@/components/FolderCard";
import { FolderIcon } from "@/components/FolderIcon";
import { SearchField } from "@/components/SearchField";
import { InvoiceDetailModal } from "@/components/InvoiceDetailModal";
import { Folder, formatINR } from "@/data/folders";
import { useToast } from "@/components/Toast";
import { useCombinedInvoices, CombinedInvoice } from "@/hooks/useCombinedInvoices";
import { useAccount } from "@/utils/account";
import { LiveInvoice } from "@/services/invoices";
import { LOCALE } from "@/config/locale";

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
  const [openInvoice, setOpenInvoice] = useState<LiveInvoice | null>(null);

  const {
    folders: allFolders,
    currentMonthCount,
    currentMonthAmount,
    trendPercent,
    invoices,
    markSeen,
  } = useCombinedInvoices();
  const { account } = useAccount();
  const name = account?.firstName ?? "there";

  const folders = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = allFolders.filter((f) => f.name.toLowerCase().includes(q));
    const cmp = SORTS[sortIndex].cmp;
    if (cmp) list = [...list].sort(cmp);
    return list;
  }, [allFolders, query, sortIndex]);

  // "Latest Bills" = your most recent LATEST_BILLS_COUNT invoices, newest
  // first, regardless of what day they're from (previously scoped to just
  // today/yesterday — changed since a quiet day left this empty even when
  // there were plenty of recent invoices from a few days back). Only live
  // invoices (pushed by a real POS) carry an exact timestamp (createdAtMs)
  // to sort by — the curated sample dataset only has a rough date label and
  // is always from a past month by design, so it never qualifies here
  // anyway. Transferred invoices are excluded, same as every other total on
  // this screen — they're no longer really "yours".
  const LATEST_BILLS_COUNT = 4;
  const latestBills = useMemo(() => {
    return invoices
      .filter((inv): inv is CombinedInvoice & { detail: LiveInvoice } => !!inv.live && !!inv.detail && !inv.transferredTo)
      .sort((a, b) => b.detail.createdAtMs - a.detail.createdAtMs)
      .slice(0, LATEST_BILLS_COUNT);
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
        renderItem={({ item }) => (
          <FolderCard folder={item} onPress={() => navigation.navigate("FolderDetail", { folderName: item.name })} />
        )}
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

            {latestBills.length > 0 && (
              <View style={styles.latestSection}>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>Latest Bills</Text>
                  <Text style={styles.sectionCount}>Most recent {latestBills.length}</Text>
                </View>
                <View style={styles.latestList}>
                  {latestBills.map((inv) => (
                    <Pressable
                      key={inv.key}
                      style={styles.latestRow}
                      onPress={() => {
                        markSeen(inv.key);
                        setOpenInvoice(inv.detail);
                      }}
                    >
                      <View style={styles.latestIcon}>
                        <FolderIcon name={inv.folder} size={14.26} color={colors.gold} />
                      </View>
                      <View style={styles.latestMeta}>
                        <Text style={styles.latestStore} numberOfLines={1}>
                          {inv.store}
                        </Text>
                        <Text style={styles.latestSub} numberOfLines={1}>
                          {inv.folder} · {inv.date}
                        </Text>
                      </View>
                      {inv.unseen && <View style={styles.latestNewDot} />}
                      <Text style={styles.latestAmount}>{formatINR(inv.amount)}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Your Folders</Text>
              <Text style={styles.sectionCount}>
                {query ? `${folders.length} of ${allFolders.length}` : `${allFolders.length} folders`}
              </Text>
            </View>
          </>
        }
      />

      <InvoiceDetailModal invoice={openInvoice} onClose={() => setOpenInvoice(null)} />
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
  // Sizing history: -1% first, then another -10% on top of that (per two
  // separate requests) — every dimension below is the prior (-1%) value
  // times 0.9.
  latestSection: { marginTop: 4 },
  latestList: { paddingHorizontal: 20, gap: 7.13 },
  latestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8.91,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11.58,
    padding: 8.91,
  },
  latestIcon: {
    width: 30.29,
    height: 30.29,
    borderRadius: 9.8,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  latestMeta: { flex: 1, minWidth: 0 },
  latestStore: { fontFamily: fonts.bodyBold, fontSize: 12.03, color: colors.navy2 },
  latestSub: { marginTop: 2, fontFamily: fonts.bodyMedium, fontSize: 9.8, color: colors.muted2 },
  latestNewDot: { width: 6.24, height: 6.24, borderRadius: 3.56, backgroundColor: colors.teal },
  latestAmount: { fontFamily: fonts.displayBold, fontSize: 12.03, color: colors.navy },
  gridContent: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
  gridRow: { gap: 8 },
  empty: { textAlign: "center", marginTop: 24, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.muted2 },
});
