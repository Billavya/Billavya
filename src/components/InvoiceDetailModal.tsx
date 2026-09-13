import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { formatINR } from "@/data/folders";
import { LiveInvoice, transferInvoice } from "@/services/invoices";
import { ContactPickerModal } from "@/components/ContactPickerModal";
import { Contact } from "@/data/contacts";
import { useToast } from "@/components/Toast";

interface Props {
  invoice: LiveInvoice | null;
  onClose: () => void;
}

type Tab = "share" | "split" | "transfer";
const TABS: { key: Tab; label: string }[] = [
  { key: "share", label: "Share" },
  { key: "split", label: "Split" },
  { key: "transfer", label: "Transfer" },
];

async function shareText(title: string, message: string) {
  try {
    await Share.share({ message, title });
  } catch {
    /* user dismissed */
  }
}

function invoiceShareText(inv: LiveInvoice) {
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
  return lines.join("\n");
}

/** Splits `total` into `n` whole-rupee shares that add back up to `total` exactly. */
function computeShares(total: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}

export function InvoiceDetailModal({ invoice, onClose }: Props) {
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("share");

  const [splitAmountText, setSplitAmountText] = useState("");
  const [splitCount, setSplitCount] = useState(2);
  const [splitPeople, setSplitPeople] = useState<Contact[]>([]);
  const [splitPickerOpen, setSplitPickerOpen] = useState(false);

  const [transferPickerOpen, setTransferPickerOpen] = useState(false);
  const [pendingTransfer, setPendingTransfer] = useState<Contact | null>(null);
  const [transferBusy, setTransferBusy] = useState(false);
  // undefined = no local override yet, defer to the invoice's own field
  const [localTransferredTo, setLocalTransferredTo] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!invoice) return;
    setTab("share");
    setSplitAmountText(String(invoice.total));
    setSplitCount(2);
    setSplitPeople([]);
    setPendingTransfer(null);
    setLocalTransferredTo(undefined);
  }, [invoice?.id]);

  const transferredTo = localTransferredTo !== undefined ? localTransferredTo : invoice?.transferredTo ?? null;

  const splitTotal = Math.max(0, parseInt(splitAmountText, 10) || 0);
  const shares = useMemo(() => computeShares(splitTotal, splitCount), [splitTotal, splitCount]);
  const splitReady = splitPeople.length === splitCount && splitCount > 0;

  function adjustSplitCount(delta: number) {
    setSplitCount((n) => {
      const next = Math.min(10, Math.max(2, n + delta));
      if (next !== n) setSplitPeople([]);
      return next;
    });
  }

  async function sendSplit() {
    if (!invoice || !splitReady) return;
    const lines = [
      `Split for Invoice ${invoice.invoiceNo || ""}`.trim(),
      `${invoice.merchant} — Total ${formatINR(splitTotal)} ÷ ${splitCount}`,
      "",
      ...splitPeople.map((p, i) => `• ${p.name}: ${formatINR(shares[i])}`),
      "",
      "Sent via SnapBill",
    ];
    await shareText(`Split — Invoice ${invoice.invoiceNo || ""}`.trim(), lines.join("\n"));
  }

  async function confirmTransfer() {
    if (!invoice || !pendingTransfer) return;
    setTransferBusy(true);
    try {
      await transferInvoice(invoice.id, pendingTransfer.name);
      setLocalTransferredTo(pendingTransfer.name);
      setPendingTransfer(null);
      showToast(`Transferred to ${pendingTransfer.name}`);
    } catch {
      showToast("Couldn't transfer — check your connection");
    } finally {
      setTransferBusy(false);
    }
  }

  async function undoTransfer() {
    if (!invoice) return;
    setTransferBusy(true);
    try {
      await transferInvoice(invoice.id, null);
      setLocalTransferredTo(null);
      showToast("Transfer undone");
    } catch {
      showToast("Couldn't undo — check your connection");
    } finally {
      setTransferBusy(false);
    }
  }

  return (
    <Modal visible={!!invoice} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {invoice && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.handle} />
              <Text style={styles.title}>Invoice {invoice.invoiceNo}</Text>
              <Text style={styles.merchant}>{invoice.merchant}</Text>
              {!!invoice.merchantAddress && <Text style={styles.address}>{invoice.merchantAddress}</Text>}
              <Text style={styles.meta}>
                {(invoice.table ? invoice.table + " · " : "") + (invoice.orderType || "Dine-in") + " · " + invoice.date}
                {invoice.gstin ? `  ·  GSTIN ${invoice.gstin}` : ""}
              </Text>

              {transferredTo && (
                <View style={styles.transferredBanner}>
                  <Text style={styles.transferredBannerText}>
                    Transferred to {transferredTo} · −{formatINR(invoice.total)}
                  </Text>
                </View>
              )}

              <View style={styles.itemsBox}>
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
              </View>
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

              <View style={styles.tabs}>
                {TABS.map((t) => (
                  <Pressable key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
                    <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
                  </Pressable>
                ))}
              </View>

              {tab === "share" && (
                <View style={styles.tabBody}>
                  <Pressable style={styles.primaryBtn} onPress={() => shareText(`SnapBill Invoice ${invoice.invoiceNo || ""}`.trim(), invoiceShareText(invoice))}>
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                      <Path d="M12 3v13M8 7l4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={styles.primaryBtnText}>Share / send / save</Text>
                  </Pressable>
                  <Text style={styles.hint}>Opens your phone's share sheet — email, WhatsApp, Messages, or Save to Files.</Text>
                </View>
              )}

              {tab === "split" && (
                <View style={styles.tabBody}>
                  <Text style={styles.fieldLabel}>Amount to split</Text>
                  <View style={styles.amountField}>
                    <Text style={styles.amountPrefix}>₹</Text>
                    <TextInput
                      style={styles.amountInput}
                      value={splitAmountText}
                      onChangeText={setSplitAmountText}
                      keyboardType="number-pad"
                    />
                  </View>

                  <Text style={styles.fieldLabel}>Split between</Text>
                  <View style={styles.stepperRow}>
                    <Pressable style={styles.stepperBtn} onPress={() => adjustSplitCount(-1)}>
                      <Text style={styles.stepperBtnText}>−</Text>
                    </Pressable>
                    <Text style={styles.stepperValue}>{splitCount} people</Text>
                    <Pressable style={styles.stepperBtn} onPress={() => adjustSplitCount(1)}>
                      <Text style={styles.stepperBtnText}>+</Text>
                    </Pressable>
                  </View>

                  <Pressable style={styles.secondaryBtn} onPress={() => setSplitPickerOpen(true)}>
                    <Text style={styles.secondaryBtnText}>
                      {splitPeople.length === 0 ? `Select ${splitCount} people` : `${splitPeople.length}/${splitCount} people selected — change`}
                    </Text>
                  </Pressable>

                  {splitReady && (
                    <View style={styles.splitBreakdown}>
                      {splitPeople.map((p, i) => (
                        <View key={p.id} style={styles.splitRow}>
                          <View style={styles.splitAvatar}>
                            <Text style={styles.splitAvatarText}>{p.name[0]}</Text>
                          </View>
                          <Text style={styles.splitName} numberOfLines={1}>
                            {p.name}
                          </Text>
                          <Text style={styles.splitShare}>{formatINR(shares[i])}</Text>
                        </View>
                      ))}
                      <View style={styles.splitFormula}>
                        <Text style={styles.splitFormulaText}>
                          {formatINR(splitTotal)} ÷ {splitCount} ≈ {formatINR(shares[0])} each
                        </Text>
                      </View>
                    </View>
                  )}

                  <Pressable style={[styles.primaryBtn, !splitReady && styles.primaryBtnDisabled]} disabled={!splitReady} onPress={sendSplit}>
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                      <Path d="M12 3v13M8 7l4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={styles.primaryBtnText}>Send split requests</Text>
                  </Pressable>
                  <Text style={styles.hint}>Opens your phone's share sheet with each person's share.</Text>
                </View>
              )}

              {tab === "transfer" && (
                <View style={styles.tabBody}>
                  {transferredTo ? (
                    <>
                      <View style={styles.transferStatus}>
                        <Text style={styles.transferStatusText}>
                          This invoice was transferred to <Text style={styles.transferStatusName}>{transferredTo}</Text>. It no
                          longer counts toward your totals.
                        </Text>
                      </View>
                      <Pressable style={[styles.secondaryBtn, transferBusy && styles.primaryBtnDisabled]} disabled={transferBusy} onPress={undoTransfer}>
                        <Text style={styles.secondaryBtnText}>{transferBusy ? "Undoing…" : "Undo transfer"}</Text>
                      </Pressable>
                    </>
                  ) : pendingTransfer ? (
                    <>
                      <View style={styles.confirmBox}>
                        <Text style={styles.confirmText}>
                          Transfer <Text style={styles.confirmAmount}>{formatINR(invoice.total)}</Text> entirely to{" "}
                          <Text style={styles.confirmName}>{pendingTransfer.name}</Text>? It will leave your invoice count and
                          totals, and show as a negative balance from then on.
                        </Text>
                      </View>
                      <View style={styles.confirmRow}>
                        <Pressable style={styles.cancelBtn} onPress={() => setPendingTransfer(null)} disabled={transferBusy}>
                          <Text style={styles.cancelBtnText}>Cancel</Text>
                        </Pressable>
                        <Pressable style={[styles.dangerBtn, transferBusy && styles.primaryBtnDisabled]} onPress={confirmTransfer} disabled={transferBusy}>
                          <Text style={styles.dangerBtnText}>{transferBusy ? "Transferring…" : "Confirm transfer"}</Text>
                        </Pressable>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.transferCopy}>
                        Pass this whole invoice to someone else. It'll disappear from your counts and totals everywhere in
                        the app, and show up as a negative balance if you ever see it again.
                      </Text>
                      <Pressable style={styles.secondaryBtn} onPress={() => setTransferPickerOpen(true)}>
                        <Text style={styles.secondaryBtnText}>Select a contact</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              )}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>

      <ContactPickerModal
        visible={splitPickerOpen}
        mode="multi"
        limit={splitCount}
        title={`Select ${splitCount} people`}
        onClose={() => setSplitPickerOpen(false)}
        onConfirm={(people) => {
          setSplitPeople(people);
          setSplitPickerOpen(false);
        }}
      />
      <ContactPickerModal
        visible={transferPickerOpen}
        mode="single"
        title="Transfer to"
        onClose={() => setTransferPickerOpen(false)}
        onConfirm={(people) => {
          setPendingTransfer(people[0] ?? null);
          setTransferPickerOpen(false);
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(11,37,69,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 30, maxHeight: "88%" },
  handle: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 14 },
  title: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.navy },
  merchant: { marginTop: 4, fontFamily: fonts.bodyBold, fontSize: 13, color: colors.navy2 },
  address: { marginTop: 2, fontFamily: fonts.bodyRegular, fontSize: 10.5, lineHeight: 14, color: colors.navy2 },
  meta: { marginTop: 4, fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.navy2 },

  transferredBanner: { marginTop: 10, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", borderRadius: 10, padding: 8 },
  transferredBannerText: { fontFamily: fonts.bodySemibold, fontSize: 11, color: "#B91C1C" },

  itemsBox: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line, borderStyle: "dashed", gap: 8 },
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

  tabs: { flexDirection: "row", gap: 6, marginTop: 18, backgroundColor: colors.appBg, borderRadius: 13, padding: 4 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center" },
  tabActive: { backgroundColor: colors.navy },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.navy2 },
  tabTextActive: { color: "#fff" },
  tabBody: { marginTop: 14 },

  primaryBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.navy,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { fontFamily: fonts.bodyBold, fontSize: 13, color: "#fff" },
  hint: { marginTop: 10, fontFamily: fonts.bodyRegular, fontSize: 10.5, lineHeight: 15, color: colors.navy2, textAlign: "center" },

  fieldLabel: { fontFamily: fonts.bodyBold, fontSize: 10.5, letterSpacing: 0.4, textTransform: "uppercase", color: colors.muted2, marginTop: 12, marginBottom: 6 },
  amountField: {
    flexDirection: "row",
    alignItems: "center",
    height: 46,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 4,
    backgroundColor: colors.appBg,
  },
  amountPrefix: { fontFamily: fonts.displayBold, fontSize: 15, color: colors.navy },
  amountInput: { flex: 1, fontFamily: fonts.displayBold, fontSize: 15, color: colors.navy, padding: 0 },
  stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, backgroundColor: colors.appBg, borderRadius: 12, paddingVertical: 8 },
  stepperBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  stepperBtnText: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.navy },
  stepperValue: { fontFamily: fonts.displayBold, fontSize: 13, color: colors.navy2, minWidth: 76, textAlign: "center" },

  secondaryBtn: { marginTop: 12, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: colors.teal, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.tealDark },

  splitBreakdown: { marginTop: 14, gap: 8 },
  splitRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  splitAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" },
  splitAvatarText: { fontFamily: fonts.displayBold, fontSize: 11, color: colors.teal },
  splitName: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.navy2 },
  splitShare: { fontFamily: fonts.displayBold, fontSize: 12, color: colors.navy },
  splitFormula: { marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line, borderStyle: "dashed" },
  splitFormulaText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.muted2, textAlign: "center" },

  transferCopy: { fontFamily: fonts.bodyRegular, fontSize: 12, lineHeight: 17, color: colors.navy2 },
  confirmBox: { backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", borderRadius: 12, padding: 12 },
  confirmText: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 17, color: "#7F1D1D" },
  confirmAmount: { fontFamily: fonts.bodyBold, color: "#7F1D1D" },
  confirmName: { fontFamily: fonts.bodyBold, color: "#7F1D1D" },
  confirmRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  cancelBtn: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  cancelBtnText: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.navy2 },
  dangerBtn: { flex: 1, height: 44, borderRadius: 12, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" },
  dangerBtnText: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: "#fff" },
  transferStatus: { backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", borderRadius: 12, padding: 12 },
  transferStatusText: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 17, color: "#7F1D1D" },
  transferStatusName: { fontFamily: fonts.bodyBold },
});
