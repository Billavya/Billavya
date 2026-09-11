import React, { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { ALL_INVOICES, FlatInvoice, formatINR } from "@/data/folders";
import { FolderIcon } from "@/components/FolderIcon";

export function SearchResultsScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const query: string = route.params?.query ?? "";
  const categories: string[] = route.params?.categories ?? [];

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_INVOICES.filter((inv) => {
      if (categories.length && !categories.includes(inv.folder)) return false;
      if (!q) return true;
      return inv.store.toLowerCase().includes(q) || inv.folder.toLowerCase().includes(q);
    });
  }, [query, categories]);

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
          </Text>
        </View>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item, i) => item.folder + item.store + i}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={<Text style={styles.empty}>No invoices match your filters.</Text>}
        renderItem={({ item }: { item: FlatInvoice }) => (
          <View style={styles.row}>
            <View style={styles.icon}>
              <FolderIcon name={item.folder} size={18} />
            </View>
            <View style={styles.meta}>
              <Text style={styles.store} numberOfLines={1}>
                {item.store}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {item.folder} · {item.date}
              </Text>
            </View>
            <Text style={styles.amount}>{formatINR(item.amount)}</Text>
          </View>
        )}
      />
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
  title: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.navy },
  subtitle: { marginTop: 2, fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.muted },
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
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.tealTint,
    alignItems: "center",
    justifyContent: "center",
  },
  meta: { flex: 1, minWidth: 0 },
  store: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.navy2 },
  sub: { marginTop: 2, fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.muted2 },
  amount: { fontFamily: fonts.displayBold, fontSize: 12, color: colors.navy },
  empty: { textAlign: "center", marginTop: 24, fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted2 },
});
