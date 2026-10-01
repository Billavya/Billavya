import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { useCombinedInvoices } from "@/hooks/useCombinedInvoices";
import { EXCLUSIVE_KINDS, ExclusiveKind } from "@/data/exclusiveKinds";

export function FoldersScreen() {
  const navigation = useNavigation<any>();
  const { invoices } = useCombinedInvoices();

  const counts = useMemo(() => {
    const c: Record<ExclusiveKind, number> = { gift: 0, warranty: 0, split: 0, transferred: 0, received: 0, other: 0 };
    for (const inv of invoices) {
      if (inv.giftLabel) c.gift++;
      if (inv.warranty) c.warranty++;
      if (inv.splitYourShare != null) c.split++;
      if (inv.transferredTo) c.transferred++;
      if (inv.otherLabel) c.other++;
    }
    return c;
  }, [invoices]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Special</Text>
        <Text style={styles.subtitle}>Gifts, warranties, split bills, and handed-off invoices — from every category.</Text>
      </View>
      <ScrollView contentContainerStyle={styles.listContent}>
        {EXCLUSIVE_KINDS.map((k) => (
          <Pressable
            key={k.kind}
            style={[styles.row, { backgroundColor: k.bg, borderColor: k.border }]}
            onPress={() => navigation.navigate("ExclusiveDetail", { kind: k.kind })}
          >
            <View style={[styles.icon, { borderColor: k.border }]}>{k.icon(colors.navy)}</View>
            <View style={styles.meta}>
              <Text style={styles.name}>{k.name}</Text>
              <Text style={styles.blurb}>{k.blurb}</Text>
            </View>
            {counts[k.kind] > 0 && (
              <View style={styles.countPill}>
                <Text style={styles.countText}>{counts[k.kind]}</Text>
              </View>
            )}
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.appBg },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  title: { fontFamily: fonts.displayBold, fontSize: 21.5, color: colors.navy },
  subtitle: { fontFamily: fonts.bodyRegular, fontSize: 13.5, color: colors.muted, marginTop: 4 },
  listContent: { padding: 20, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.card,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  meta: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.displaySemibold, fontSize: 16, color: colors.navy },
  blurb: { marginTop: 2, fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.navy2 },
  countPill: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  countText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.navy },
  chevron: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.navy2 },
});
