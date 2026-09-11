import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { FOLDERS, INVOICES_BY_FOLDER, OFFERS_BY_FOLDER, formatINR, FolderIconKey } from "@/data/folders";
import { FolderIcon } from "@/components/FolderIcon";
import { useProfileId } from "@/utils/profileId";
import { subscribeInvoices, LiveInvoice } from "@/services/invoices";

interface DisplayInvoice {
  store: string;
  date: string;
  amount: number;
  unseen?: boolean;
  live?: boolean;
  detail?: LiveInvoice;
}

export function FolderDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const folderName: FolderIconKey = route.params?.folderName;
  const folder = FOLDERS.find((f) => f.name === folderName);
  const offers = OFFERS_BY_FOLDER[folderName] || [];
  const staticInvoices = INVOICES_BY_FOLDER[folderName] || [];

  const { id: myId } = useProfileId();
  const [live, setLive] = useState<LiveInvoice[]>([]);
  const [open, setOpen] = useState<LiveInvoice | null>(null);

  useEffect(() => {
    if (folderName !== "Food" || !myId) return;
    const unsub = subscribeInvoices(myId, "Food", setLive);
    return unsub;
  }, [folderName, myId]);

  const invoices: DisplayInvoice[] = useMemo(() => {
    const fromLive: DisplayInvoice[] = live.map((li) => ({
      store: li.merchant,
      date: li.date,
      amount: li.total,
      unseen: true,
      live: true,
      detail: li,
    }));
    return [...fromLive, ...staticInvoices];
  }, [live, staticInvoices]);

  const totalAmount = invoices.reduce((s, i) => s + i.amount, 0);
  const count = invoices.length;

  async function shareInvoice(inv: LiveInvoice) {
    const lines = [
      `SnapBill Invoice ${inv.invoiceNo || ""}`.trim(),
      `${inv.merchant}${inv.date ? " — " + inv.date : ""}`,
      ...(inv.merchantAddress ? [inv.merchantAddress] : []),
      ...(inv.gstin ? [`GSTIN: ${inv.gstin}`] : []),
      "",
      ...(inv.items || []).map(
        (it) => `• ${it.name}${it.variant ? ` (${it.variant})` : ""} × ${it.qty} — ${formatINR(it.unit * it.qty)}`
      ),
      "",
      `Total paid: ${formatINR(inv.total)}`,
      "Sent via SnapBill",
    ];
    try {
      await Share.share({ message: lines.join("\n"), title: `SnapBill Invoice ${inv.invoiceNo || ""}`.trim() });
    } catch {
      /* user dismissed */
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M15 5 8 12l7 7" stroke={colors.navy} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <View style={styles.folderIcon}>
          <FolderIcon name={folderName} size={18} />
          <View style={styles.folderDot} />
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{folderName}</Text>
          <Text style={styles.subtitle}>
            {folder ? `${count} invoices · ${formatINR(totalAmount || folder.amount)} this month` : ""}
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
              <Text style={styles.countTextInvoices}>{count}</Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.colBody} showsVerticalScrollIndicator={false}>
            {invoices.length === 0 && <Text style={styles.emptyNote}>No invoices in this folder yet.</Text>}
            {invoices.map((inv, i) => {
              const card = (
                <>
                  {inv.live && (
                    <View style={styles.newTag}>
                      <Text style={styles.newTagText}>NEW</Text>
                    </View>
                  )}
                  {inv.unseen && !inv.live && <View style={styles.unseenDot} />}
                  <Text style={styles.invStore} numberOfLines={1}>
                    {inv.store}
                  </Text>
                  <Text style={styles.invDate}>{inv.date}</Text>
                  <Text style={styles.invAmt}>{formatINR(inv.amount)}</Text>
                  {inv.live && <Text style={styles.invTapHint}>Tap to open attachment</Text>}
                </>
              );
              return inv.live && inv.detail ? (
                <Pressable key={i} style={[styles.invCard, styles.invCardLive]} onPress={() => setOpen(inv.detail!)}>
                  {card}
                </Pressable>
              ) : (
                <View key={i} style={styles.invCard}>
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

      <Modal visible={!!open} transparent animationType="slide" onRequestClose={() => setOpen(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {open && (
              <>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle}>Invoice {open.invoiceNo}</Text>
                <Text style={styles.sheetMerchant}>{open.merchant}</Text>
                {!!open.merchantAddress && <Text style={styles.sheetAddress}>{open.merchantAddress}</Text>}
                <Text style={styles.sheetMeta}>
                  {(open.table ? open.table + " · " : "") + (open.orderType || "Dine-in") + " · " + open.date}
                  {open.gstin ? `  ·  GSTIN ${open.gstin}` : ""}
                </Text>
                <ScrollView style={styles.sheetItems} contentContainerStyle={{ gap: 8 }}>
                  {(open.items || []).map((it, i) => (
                    <View key={i} style={styles.sheetItemRow}>
                      <Text style={styles.sheetItemName} numberOfLines={1}>
                        {it.name}
                        {it.variant ? <Text style={styles.sheetItemVariant}>  {it.variant}</Text> : null}
                      </Text>
                      <Text style={styles.sheetItemAmt}>
                        {it.qty} × {formatINR(it.unit)}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
                <View style={styles.sheetTotals}>
                  {open.subtotal != null && (
                    <View style={styles.sheetTotRow}>
                      <Text style={styles.sheetTotLabel}>Subtotal</Text>
                      <Text style={styles.sheetTotVal}>{formatINR(open.subtotal)}</Text>
                    </View>
                  )}
                  {!!open.tax && (
                    <View style={styles.sheetTotRow}>
                      <Text style={styles.sheetTotLabel}>CGST + SGST</Text>
                      <Text style={styles.sheetTotVal}>{formatINR(open.tax)}</Text>
                    </View>
                  )}
                  {!!open.discount && (
                    <View style={styles.sheetTotRow}>
                      <Text style={styles.sheetTotLabel}>Discount</Text>
                      <Text style={styles.sheetTotVal}>−{formatINR(open.discount)}</Text>
                    </View>
                  )}
                  <View style={[styles.sheetTotRow, styles.sheetGrand]}>
                    <Text style={styles.sheetGrandLabel}>Total paid</Text>
                    <Text style={styles.sheetGrandVal}>{formatINR(open.total)}</Text>
                  </View>
                </View>
                <Pressable style={styles.shareBtn} onPress={() => shareInvoice(open)}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path d="M12 3v13M8 7l4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={styles.shareBtnText}>Share / send / save</Text>
                </Pressable>
                <Text style={styles.sheetHint}>
                  Opens your phone's share sheet — email, WhatsApp, Messages, or Save to Files.
                </Text>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
    backgroundColor: colors.tealTint,
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
  invStore: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: colors.navy2, paddingRight: 12 },
  invDate: { marginTop: 2, fontFamily: fonts.bodyMedium, fontSize: 9.5, color: colors.navy2 },
  invAmt: { marginTop: 6, fontFamily: fonts.displayBold, fontSize: 12.5, color: colors.navy },
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

  modalOverlay: { flex: 1, backgroundColor: "rgba(11,37,69,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 30, maxHeight: "82%" },
  sheetHandle: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 14 },
  sheetTitle: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.navy },
  sheetMerchant: { marginTop: 4, fontFamily: fonts.bodyBold, fontSize: 13, color: colors.navy2 },
  sheetAddress: { marginTop: 2, fontFamily: fonts.bodyRegular, fontSize: 10.5, lineHeight: 14, color: colors.navy2 },
  sheetMeta: { marginTop: 4, fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.navy2 },
  sheetItems: { marginTop: 14, paddingTop: 14, maxHeight: 220, borderTopWidth: 1, borderTopColor: colors.line, borderStyle: "dashed" },
  sheetItemRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  sheetItemName: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.navy2 },
  sheetItemVariant: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.navy2 },
  sheetItemAmt: { fontFamily: fonts.displayBold, fontSize: 11, color: colors.navy },
  sheetTotals: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line, borderStyle: "dashed" },
  sheetTotRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  sheetTotLabel: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.navy2 },
  sheetTotVal: { fontFamily: fonts.bodySemibold, fontSize: 11.5, color: colors.navy2 },
  sheetGrand: { marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line },
  sheetGrandLabel: { fontFamily: fonts.displayBold, fontSize: 14, color: colors.navy },
  sheetGrandVal: { fontFamily: fonts.displayBold, fontSize: 14, color: colors.navy },
  shareBtn: {
    marginTop: 18,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.navy,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  shareBtnText: { fontFamily: fonts.bodyBold, fontSize: 13, color: "#fff" },
  sheetHint: { marginTop: 10, fontFamily: fonts.bodyRegular, fontSize: 10.5, lineHeight: 15, color: colors.navy2, textAlign: "center" },
});
