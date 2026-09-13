import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { OFFERS_BY_FOLDER, formatINR, FolderIconKey } from "@/data/folders";
import { FolderIcon } from "@/components/FolderIcon";
import { InvoiceDetailModal } from "@/components/InvoiceDetailModal";
import { LiveInvoice } from "@/services/invoices";
import { useCombinedInvoices } from "@/hooks/useCombinedInvoices";

export function FolderDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const folderName: FolderIconKey = route.params?.folderName;
  const offers = OFFERS_BY_FOLDER[folderName] || [];

  // Same source the home screen and Insights use, so the count/total shown
  // here always matches what's shown on the folder card and top summary.
  const { folders, invoices: allInvoices } = useCombinedInvoices();
  const mergedFolder = folders.find((f) => f.name === folderName);
  const invoices = useMemo(() => allInvoices.filter((inv) => inv.folder === folderName), [allInvoices, folderName]);

  const [open, setOpen] = useState<LiveInvoice | null>(null);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M15 5 8 12l7 7" stroke={colors.navy} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <View style={styles.folderIcon}>
          <FolderIcon name={folderName} size={18} color={colors.teal} />
          <View style={styles.folderDot} />
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{folderName}</Text>
          <Text style={styles.subtitle}>
            {mergedFolder ? `${mergedFolder.count} invoices · ${formatINR(mergedFolder.amount)} this month` : ""}
          </Text>
        </View>
      </View>

      <View style={styles.split}>
        <View style={[styles.col, styles.colInvoices]}>
          <View style={styles.colHead}>
            <View style={styles.colTitleRow}>
              <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                <Path d="M3 4h2l2.4 11.6a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 1.95-1.55L20 8H6.2" stroke={colors.navy} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.colTitleInvoices}>Invoices</Text>
            </View>
            <View style={styles.countPillInvoices}>
              <Text style={styles.countTextInvoices}>{invoices.length}</Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.colBody} showsVerticalScrollIndicator={false}>
            {invoices.length === 0 && <Text style={styles.emptyNote}>No invoices in this folder yet.</Text>}
            {invoices.map((inv) => {
              const transferred = !!inv.transferredTo;
              const card = (
                <>
                  {transferred ? (
                    <View style={styles.transferTag}>
                      <Text style={styles.transferTagText}>TRANSFERRED</Text>
                    </View>
                  ) : (
                    inv.live && (
                      <View style={styles.newTag}>
                        <Text style={styles.newTagText}>NEW</Text>
                      </View>
                    )
                  )}
                  {inv.unseen && !inv.live && <View style={styles.unseenDot} />}
                  <Text style={styles.invStore} numberOfLines={1}>
                    {inv.store}
                  </Text>
                  <Text style={styles.invDate}>{inv.date}</Text>
                  <Text style={[styles.invAmt, transferred && styles.invAmtNegative]}>
                    {transferred ? "−" : ""}
                    {formatINR(inv.amount)}
                  </Text>
                  {transferred ? (
                    <Text style={styles.transferToHint}>To {inv.transferredTo}</Text>
                  ) : (
                    inv.live && <Text style={styles.invTapHint}>Tap to open attachment</Text>
                  )}
                </>
              );
              return inv.live && inv.detail ? (
                <Pressable
                  key={inv.key}
                  style={[styles.invCard, styles.invCardLive, transferred && styles.invCardTransferred]}
                  onPress={() => setOpen(inv.detail!)}
                >
                  {card}
                </Pressable>
              ) : (
                <View key={inv.key} style={styles.invCard}>
                  {card}
                </View>
              );
            })}
          </ScrollView>
        </View>

        <View style={[styles.col, styles.colOffers]}>
          <View style={styles.colHead}>
            <View style={styles.colTitleRow}>
              <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                <Path d="M20 12 12 20l-8-8V5a1 1 0 0 1 1-1h7l8 8Z" stroke={colors.amberInk} strokeWidth={2} strokeLinejoin="round" />
                <Circle cx="7.5" cy="7.5" r="1.4" fill={colors.amberInk} />
              </Svg>
              <Text style={styles.colTitleOffers}>Offers</Text>
            </View>
            <View style={styles.countPillOffers}>
              <Text style={styles.countTextOffers}>{offers.length}</Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.colBody} showsVerticalScrollIndicator={false}>
            {offers.length === 0 && <Text style={styles.emptyNote}>No live offers right now.</Text>}
            {offers.map((o, i) => (
              <View key={i} style={styles.offCard}>
                <Text style={styles.offPct}>{o.pct}</Text>
                <Text style={styles.offMerchant} numberOfLines={1}>
                  {o.merchant}
                </Text>
                <Text style={styles.offDesc}>{o.desc}</Text>
                <View style={styles.offExpRow}>
                  <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                    <Circle cx="12" cy="12" r="9" stroke={colors.amberInk2} strokeWidth={2} />
                    <Path d="M12 7v5l3 2" stroke={colors.amberInk2} strokeWidth={2} strokeLinecap="round" />
                  </Svg>
                  <Text style={styles.offExp}>{o.exp}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>

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
  folderIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  folderDot: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.teal,
    borderWidth: 1.5,
    borderColor: colors.appBg,
  },
  titleWrap: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.navy },
  subtitle: { marginTop: 2, fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.navy2 },
  split: { flex: 1, flexDirection: "row", marginTop: 14, marginHorizontal: 20, borderTopWidth: 1, borderTopColor: colors.line },
  col: { flex: 1, minWidth: 0 },
  colInvoices: { paddingRight: 9, borderRightWidth: 1, borderRightColor: colors.line, borderStyle: "dashed" },
  colOffers: { paddingLeft: 9 },
  colHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 11 },
  colTitleRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  colTitleInvoices: { fontFamily: fonts.displaySemibold, fontSize: 11.5, color: colors.navy },
  colTitleOffers: { fontFamily: fonts.displaySemibold, fontSize: 11.5, color: colors.amberInk },
  countPillInvoices: { backgroundColor: colors.appBg, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 999 },
  countTextInvoices: { fontFamily: fonts.bodyBold, fontSize: 9, color: colors.navy2 },
  countPillOffers: { backgroundColor: colors.amberTint, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 999 },
  countTextOffers: { fontFamily: fonts.bodyBold, fontSize: 9, color: colors.amberInk },
  colBody: { gap: 7, paddingBottom: 16 },
  invCard: { position: "relative", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 9 },
  invCardLive: { borderColor: colors.teal, backgroundColor: colors.tealTint },
  unseenDot: { position: "absolute", top: 9, right: 9, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green },
  newTag: {
    position: "absolute",
    top: -7,
    right: 7,
    backgroundColor: colors.teal,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  newTagText: { fontFamily: fonts.bodyBold, fontSize: 7.5, color: "#fff", letterSpacing: 0.4 },
  invCardTransferred: { borderColor: "#FECACA", backgroundColor: "#FEF2F2" },
  transferTag: {
    position: "absolute",
    top: -7,
    right: 7,
    backgroundColor: "#EF4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  transferTagText: { fontFamily: fonts.bodyBold, fontSize: 7.5, color: "#fff", letterSpacing: 0.4 },
  transferToHint: { marginTop: 4, fontFamily: fonts.bodySemibold, fontSize: 8, color: "#B91C1C" },
  invStore: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: colors.navy2, paddingRight: 12 },
  invDate: { marginTop: 2, fontFamily: fonts.bodyMedium, fontSize: 9.5, color: colors.navy2 },
  invAmt: { marginTop: 6, fontFamily: fonts.displayBold, fontSize: 12.5, color: colors.navy },
  invAmtNegative: { color: "#B91C1C" },
  invTapHint: { marginTop: 4, fontFamily: fonts.bodySemibold, fontSize: 8, color: colors.tealDark },
  offCard: { backgroundColor: colors.amberTint2, borderWidth: 1, borderColor: colors.amberLine, borderRadius: 12, padding: 9 },
  offPct: {
    alignSelf: "flex-start",
    fontFamily: fonts.displayExtraBold,
    fontSize: 9.5,
    color: colors.amberInk,
    backgroundColor: colors.amberLine,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
    overflow: "hidden",
  },
  offMerchant: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: colors.navy2 },
  offDesc: { marginTop: 3, fontFamily: fonts.bodyMedium, fontSize: 9.5, lineHeight: 13, color: colors.amberInk },
  offExpRow: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 3 },
  offExp: { fontFamily: fonts.bodySemibold, fontSize: 9, color: colors.amberInk2 },
  emptyNote: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.navy2, textAlign: "center", padding: 14 },
});
