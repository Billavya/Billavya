import React, { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { FolderRow } from "@/components/FolderCard";
import { useCombinedInvoices } from "@/hooks/useCombinedInvoices";

export function FoldersScreen() {
  const navigation = useNavigation<any>();
  const { folders, invoices } = useCombinedInvoices();
  const alphabetical = useMemo(() => [...folders].sort((a, b) => a.name.localeCompare(b.name)), [folders]);
  const exclusiveCount = useMemo(
    () => invoices.filter((inv) => inv.giftLabel || inv.warranty || inv.transferredTo || inv.otherLabel).length,
    [invoices]
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Special</Text>
        <Text style={styles.subtitle}>Every category, A to Z.</Text>
      </View>
      <FlatList
        data={alphabetical}
        keyExtractor={(item) => item.name}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <FolderRow folder={item} onPress={() => navigation.navigate("FolderDetail", { folderName: item.name })} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListHeaderComponent={
          <Pressable style={styles.exclusiveRow} onPress={() => navigation.navigate("Exclusive")}>
            <View style={styles.exclusiveIcon}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="m12 3 2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L12 17l-5.6 3.1 1.4-6.3-4.8-4.3 6.4-.6L12 3Z" stroke={colors.navy} strokeWidth={1.8} strokeLinejoin="round" />
              </Svg>
            </View>
            <View style={styles.exclusiveMeta}>
              <Text style={styles.exclusiveName}>Exclusive</Text>
              <Text style={styles.exclusiveSub}>Gifts &amp; warranty items, from every folder</Text>
            </View>
            {exclusiveCount > 0 && (
              <View style={styles.exclusiveCountPill}>
                <Text style={styles.exclusiveCountText}>{exclusiveCount}</Text>
              </View>
            )}
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.appBg },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  title: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.navy },
  subtitle: { fontFamily: fonts.bodyRegular, fontSize: 12.5, color: colors.muted, marginTop: 4 },
  listContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  exclusiveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 14,
    padding: 13,
    marginBottom: 12,
  },
  exclusiveIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#FDE68A", alignItems: "center", justifyContent: "center" },
  exclusiveMeta: { flex: 1, minWidth: 0 },
  exclusiveName: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.navy },
  exclusiveSub: { marginTop: 1, fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.amberInk2 },
  exclusiveCountPill: { backgroundColor: "#FDE68A", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  exclusiveCountText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.navy },
  chevron: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.amberInk2 },
});
