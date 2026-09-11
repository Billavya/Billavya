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
import { SearchField } from "@/components/SearchField";
import { FOLDERS, Folder } from "@/data/folders";
import { useToast } from "@/components/Toast";

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

  const folders = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = FOLDERS.filter((f) => f.name.toLowerCase().includes(q));
    const cmp = SORTS[sortIndex].cmp;
    if (cmp) list = [...list].sort(cmp);
    return list;
  }, [query, sortIndex]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <AppHeader />

      <View style={styles.greeting}>
        <Text style={styles.greetingTitle}>Hi, Ananya</Text>
        <Text style={styles.greetingSub}>Here's your spending, organized by folder.</Text>
      </View>

      <StatStrip
        invoiceCount={137}
        totalTracked="₹84,070"
        totalTrackedMasked="₹••,•••"
        monthLabel="Sep"
        trendPercent={12}
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

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Your Folders</Text>
        <Text style={styles.sectionCount}>
          {query ? `${folders.length} of ${FOLDERS.length}` : `${FOLDERS.length} folders`}
        </Text>
      </View>

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
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.appBg },
  greeting: { paddingHorizontal: 20, paddingTop: 12 },
  greetingTitle: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.navy },
  greetingSub: { fontFamily: fonts.bodyRegular, fontSize: 12.5, color: colors.muted, marginTop: 2 },
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
  sectionTitle: { fontFamily: fonts.displayBold, fontSize: 14.5, color: colors.navy },
  sectionCount: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.muted2 },
  gridContent: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
  gridRow: { gap: 8 },
  empty: { textAlign: "center", marginTop: 24, fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted2 },
});
