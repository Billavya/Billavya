import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { formatINR } from "@/data/folders";
import { SpendPieChart } from "@/components/SpendPieChart";
import { useCombinedInvoices } from "@/hooks/useCombinedInvoices";

export function InsightsScreen() {
  const { totalCount, totalAmount, byFolder, invoices } = useCombinedInvoices();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Insights</Text>
          <Text style={styles.subtitle}>
            {totalCount} invoices tracked · {formatINR(totalAmount)} total
          </Text>
        </View>

        <SpendPieChart byFolder={byFolder} invoices={invoices} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.appBg },
  scrollContent: { paddingBottom: 24 },
  titleBlock: { paddingHorizontal: 20, paddingTop: 12 },
  title: { fontFamily: fonts.displayBold, fontSize: 21.5, color: colors.navy },
  subtitle: { fontFamily: fonts.bodyRegular, fontSize: 13.5, color: colors.muted, marginTop: 2 },
});
