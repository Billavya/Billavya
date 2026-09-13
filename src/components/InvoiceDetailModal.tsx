import React from "react";
import { Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { formatINR } from "@/data/folders";
import { LiveInvoice } from "@/services/invoices";

interface Props {
  invoice: LiveInvoice | null;
  onClose: () => void;
}

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

/**
 * The digital-invoice bottom sheet — used wherever a live (POS-pushed) invoice
 * can be tapped open: the folder detail view and search results alike.
 */
export function InvoiceDetailModal({ invoice, onClose }: Props) {
  return (
    <Modal visible={!!invoice} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {invoice && (
            <>
              <View style={styles.handle} />
              <Text style={styles.title}>Invoice {invoice.invoiceNo}</Text>
              <Text style={styles.merchant}>{invoice.merchant}</Text>
              {!!invoice.merchantAddress && <Text style={styles.address}>{invoice.merchantAddress}</Text>}
              <Text style={styles.meta}>
                {(invoice.table ? invoice.table + " · " : "") + (invoice.orderType || "Dine-in") + " · " + invoice.date}
                {invoice.gstin ? `  ·  GSTIN ${invoice.gstin}` : ""}
              </Text>
              <ScrollView style={styles.items} contentContainerStyle={{ gap: 8 }}>
                {(invoice.items || []).map((it, i) => (
                  <View key={i} style={styles.itemRow}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {it.name}
                      {it.variant ? <Text style={styles.itemVariant}>  {it.variant}</Text> : null}
                    </Text>
                    <Text style={styles.itemAmt}>
                      {it.qty} × {formatINR(it.unit)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
              <View style={styles.totals}>
                {invoice.subtotal != null && (
                  <View style={styles.totRow}>
                    <Text style={styles.totLabel}>Subtotal</Text>
                    <Text style={styles.totVal}>{formatINR(invoice.subtotal)}</Text>
                  </View>
                )}
                {!!invoice.tax && (
                  <View style={styles.totRow}>
                    <Text style={styles.totLabel}>CGST + SGST</Text>
                    <Text style={styles.totVal}>{formatINR(invoice.tax)}</Text>
                  </View>
                )}
                {!!invoice.discount && (
                  <View style={styles.totRow}>
                    <Text style={styles.totLabel}>Discount</Text>
                    <Text style={styles.totVal}>−{formatINR(invoice.discount)}</Text>
                  </View>
                )}
                <View style={[styles.totRow, styles.grand]}>
                  <Text style={styles.grandLabel}>Total paid</Text>
                  <Text style={styles.grandVal}>{formatINR(invoice.total)}</Text>
                </View>
              </View>
              <Pressable style={styles.shareBtn} onPress={() => shareInvoice(invoice)}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 3v13M8 7l4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={styles.shareBtnText}>Share / send / save</Text>
              </Pressable>
              <Text style={styles.hint}>Opens your phone's share sheet — email, WhatsApp, Messages, or Save to Files.</Text>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(11,37,69,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 30, maxHeight: "82%" },
  handle: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 14 },
  title: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.navy },
  merchant: { marginTop: 4, fontFamily: fonts.bodyBold, fontSize: 13, color: colors.navy2 },
  address: { marginTop: 2, fontFamily: fonts.bodyRegular, fontSize: 10.5, lineHeight: 14, color: colors.navy2 },
  meta: { marginTop: 4, fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.navy2 },
  items: { marginTop: 14, paddingTop: 14, maxHeight: 220, borderTopWidth: 1, borderTopColor: colors.line, borderStyle: "dashed" },
  itemRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  itemName: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.navy2 },
  itemVariant: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.navy2 },
  itemAmt: { fontFamily: fonts.displayBold, fontSize: 11, color: colors.navy },
  totals: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line, borderStyle: "dashed" },
  totRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totLabel: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.navy2 },
  totVal: { fontFamily: fonts.bodySemibold, fontSize: 11.5, color: colors.navy2 },
  grand: { marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line },
  grandLabel: { fontFamily: fonts.displayBold, fontSize: 14, color: colors.navy },
  grandVal: { fontFamily: fonts.displayBold, fontSize: 14, color: colors.navy },
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
  hint: { marginTop: 10, fontFamily: fonts.bodyRegular, fontSize: 10.5, lineHeight: 15, color: colors.navy2, textAlign: "center" },
});
