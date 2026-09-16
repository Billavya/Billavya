import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { OFFERS_BY_FOLDER, formatINR, FolderIconKey } from "@/data/folders";
import { FolderIcon } from "@/components/FolderIcon";
import { InvoiceDetailModal } from "@/components/InvoiceDetailModal";
import { OfferDetailModal } from "@/components/OfferDetailModal";
import { LiveInvoice } from "@/services/invoices";
import { LiveOffer, subscribeOffers } from "@/services/offers";
import { useCombinedInvoices } from "@/hooks/useCombinedInvoices";
import { useProfileId } from "@/utils/profileId";
import { useToast } from "@/components/Toast";

const CURRENT_MONTH = new Date().toLocaleString("en-US", { month: "short" });

interface DisplayOffer {
  key: string;
  pct: string;
  merchant: string;
  desc: string;
  exp: string;
  expired: boolean;
  live?: boolean;
  detail?: LiveOffer;
}

export function FolderDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const folderName: FolderIconKey = route.params?.folderName;
  const { showToast } = useToast();
  const { id: myId } = useProfileId();

  const [liveOffers, setLiveOffers] = useState<LiveOffer[]>([]);
  useEffect(() => {
    if (!myId) return;
    return subscribeOffers(myId, folderName, setLiveOffers);
  }, [myId, folderName]);

  const offers: DisplayOffer[] = useMemo(() => {
    const live: DisplayOffer[] = liveOffers.map((o) => ({
      key: o.id,
      pct: o.pct,
      merchant: o.merchant,
      desc: o.desc,
      exp: o.exp,
      expired: false,
      live: true,
      detail: o,
    }));
    const expired: DisplayOffer[] = (OFFERS_BY_FOLDER[folderName] || []).map((o, i) => ({
      key: `static-${folderName}-${i}`,
      pct: o.pct,
      merchant: o.merchant,
      desc: o.desc,
      exp: o.exp,
      expired: true,
    }));
    return [...live, ...expired];
  }, [liveOffers, folderName]);

  // Same source the home screen and Insights use, so the count/total shown
  // here always matches what's shown on the folder card and top summary.
  const { folders, invoices: allInvoices, markSeen } = useCombinedInvoices();
  const mergedFolder = folders.find((f) => f.name === folderName);
  const invoices = useMemo(() => allInvoices.filter((inv) => inv.folder === folderName), [allInvoices, folderName]);

  const [open, setOpen] = useState<LiveInvoice | null>(null);
  const [openOffer, setOpenOffer] = useState<LiveOffer | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedCount = Object.keys(selected).length;

  function openInvoice(inv: (typeof invoices)[number]) {
    if (selectMode) {
      setSelected((prev) => {
        const next = { ...prev };
        if (next[inv.key]) delete next[inv.key];
        else next[inv.key] = true;
        return next;
      });
      return;
    }
    markSeen(inv.key);
    if (inv.detail) setOpen(inv.detail);
    else showToast("No digital copy for this invoice.");
  }

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelected({});
  }

  async function shareSelected() {
    const chosen = invoices.filter((inv) => selected[inv.key]);
    if (chosen.length === 0) return;
    const total = chosen.reduce((s, inv) => s + inv.amount, 0);
    const lines = [
      `${folderName} — ${chosen.length} invoice${chosen.length === 1 ? "" : "s"}`,
      "",
      ...chosen.map((inv) => `• ${inv.store} — ${inv.date} — ${formatINR(inv.amount)}`),
      "",
      `Total: ${formatINR(total)}`,
      "Sent via SnapBill",
    ];
    try {
      await Share.share({ message: lines.join("\n"), title: `${folderName} invoices` });
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
          <FolderIcon name={folderName} size={18} color={colors.teal} />
          <View style={styles.folderDot} />
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{folderName}</Text>
          <Text style={styles.subtitle}>
            {mergedFolder ? `${CURRENT_MONTH} · ${mergedFolder.count} invoices · ${formatINR(mergedFolder.amount)}` : ""}
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
            <View style={styles.colHeadActions}>
              <View style={styles.countPillInvoices}>
                <Text style={styles.countTextInvoices}>{invoices.length}</Text>
              </View>
              {invoices.length > 0 && (
                <Pressable onPress={toggleSelectMode}>
                  <Text style={styles.selectToggle}>{selectMode ? "Cancel" : "Select"}</Text>
                </Pressable>
              )}
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.colBody} showsVerticalScrollIndicator={false}>
            {invoices.length === 0 && <Text style={styles.emptyNote}>No invoices in this folder yet.</Text>}
            {invoices.map((inv) => {
              const transferred = !!inv.transferredTo;
              const isChecked = !!selected[inv.key];
              const card = (
                <>
                  {selectMode && (
                    <View style={[styles.checkbox, isChecked && styles.checkboxOn]}>
                      {isChecked && <Text style={styles.checkboxMark}>✓</Text>}
                    </View>
                  )}
                  {transferred ? (
                    <View style={styles.transferTag}>
                      <Text style={styles.transferTagText}>TRANSFERRED</Text>
                    </View>
                  ) : (
                    inv.live &&
                    inv.unseen && (
                      <View style={styles.newTag}>
                        <Text style={styles.newTagText}>NEW</Text>
                      </View>
                    )
                  )}
                  {inv.unseen && !inv.live && <View style={styles.unseenDot} />}
                  {inv.favorite && !transferred && (
                    <Svg width={11} height={11} viewBox="0 0 24 24" fill={colors.teal} style={styles.favStar}>
                      <Path d="m12 3 2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L12 17l-5.6 3.1 1.4-6.3-4.8-4.3 6.4-.6L12 3Z" />
                    </Svg>
                  )}
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
              return inv.live ? (
                <Pressable
                  key={inv.key}
                  style={[styles.invCard, styles.invCardLive, transferred && styles.invCardTransferred, isChecked && styles.invCardChecked]}
                  onPress={() => openInvoice(inv)}
                >
                  {card}
                </Pressable>
              ) : (
                <Pressable key={inv.key} style={[styles.invCard, isChecked && styles.invCardChecked]} onPress={() => openInvoice(inv)}>
                  {card}
                </Pressable>
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
            {offers.length === 0 && <Text style={styles.emptyNote}>No offers right now.</Text>}
            {offers.map((o) => {
              const card = (
                <>
                  {o.live && (
                    <View style={[styles.offLiveTag, o.detail?.activated && styles.offActivatedTag]}>
                      <Text style={styles.offLiveTagText}>{o.detail?.activated ? "ACTIVATED" : "FOR YOU"}</Text>
                    </View>
                  )}
                  <Text style={[styles.offPct, o.expired && styles.offPctExpired]}>{o.pct}</Text>
                  <Text style={[styles.offMerchant, o.expired && styles.offTextExpired]} numberOfLines={1}>
                    {o.merchant}
                  </Text>
                  <Text style={[styles.offDesc, o.expired && styles.offTextExpired]}>{o.desc}</Text>
                  <View style={styles.offExpRow}>
                    <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                      <Circle cx="12" cy="12" r="9" stroke={o.expired ? colors.muted2 : colors.amberInk2} strokeWidth={2} />
                      <Path d="M12 7v5l3 2" stroke={o.expired ? colors.muted2 : colors.amberInk2} strokeWidth={2} strokeLinecap="round" />
                    </Svg>
                    <Text style={[styles.offExp, o.expired && styles.offTextExpired]}>{o.expired ? "EXPIRED" : o.exp}</Text>
                  </View>
                  {o.live && (
                    <Text style={styles.offTapHint}>{o.detail?.activated ? "Tap to view redemption code" : "Tap to open"}</Text>
                  )}
                </>
              );
              function pressOffer() {
                if (o.expired) {
                  showToast("This offer has expired.");
                  return;
                }
                if (o.detail) setOpenOffer(o.detail);
              }
              return (
                <Pressable key={o.key} style={[styles.offCard, o.expired && styles.offCardExpired]} onPress={pressOffer}>
                  {card}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {selectMode && selectedCount > 0 && (
        <View style={styles.shareBar}>
          <Text style={styles.shareBarCount}>{selectedCount} selected</Text>
          <Pressable style={styles.shareBarBtn} onPress={shareSelected}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path d="M12 3v13M8 7l4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.shareBarBtnText}>Share</Text>
          </Pressable>
        </View>
      )}

      <InvoiceDetailModal invoice={open} onClose={() => setOpen(null)} />
      <OfferDetailModal offer={openOffer} onClose={() => setOpenOffer(null)} />
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
  colHeadActions: { flexDirection: "row", alignItems: "center", gap: 9 },
  selectToggle: { fontFamily: fonts.bodyBold, fontSize: 10.5, color: colors.tealDark },
  countPillInvoices: { backgroundColor: colors.appBg, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 999 },
  countTextInvoices: { fontFamily: fonts.bodyBold, fontSize: 9, color: colors.navy2 },
  countPillOffers: { backgroundColor: colors.amberTint, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 999 },
  countTextOffers: { fontFamily: fonts.bodyBold, fontSize: 9, color: colors.amberInk },
  colBody: { gap: 7, paddingBottom: 16 },
  invCard: { position: "relative", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 9 },
  invCardLive: { borderColor: colors.teal, backgroundColor: colors.tealTint },
  unseenDot: { position: "absolute", top: 9, right: 9, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green },
  favStar: { position: "absolute", top: 9, right: 9 },
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
  invCardChecked: { borderColor: colors.teal, borderWidth: 1.5 },
  checkbox: {
    position: "absolute",
    top: 9,
    left: 9,
    width: 17,
    height: 17,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  checkboxOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  checkboxMark: { color: "#fff", fontSize: 11, fontWeight: "700" },
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
  offCard: { position: "relative", backgroundColor: colors.amberTint2, borderWidth: 1, borderColor: colors.amberLine, borderRadius: 12, padding: 9 },
  offCardExpired: { backgroundColor: "#F1F3F5", borderColor: colors.line, opacity: 0.6 },
  offLiveTag: {
    position: "absolute",
    top: -7,
    right: 7,
    backgroundColor: colors.teal,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  offActivatedTag: { backgroundColor: colors.navy },
  offLiveTagText: { fontFamily: fonts.bodyBold, fontSize: 7.5, color: "#fff", letterSpacing: 0.4 },
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
  offPctExpired: { color: colors.muted2, backgroundColor: colors.line, textDecorationLine: "line-through" },
  offMerchant: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: colors.navy2 },
  offDesc: { marginTop: 3, fontFamily: fonts.bodyMedium, fontSize: 9.5, lineHeight: 13, color: colors.amberInk },
  offExpRow: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 3 },
  offExp: { fontFamily: fonts.bodySemibold, fontSize: 9, color: colors.amberInk2 },
  offTextExpired: { color: colors.muted2 },
  offTapHint: { marginTop: 5, fontFamily: fonts.bodySemibold, fontSize: 8, color: colors.tealDark },
  emptyNote: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.navy2, textAlign: "center", padding: 14 },
  shareBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.navy,
    borderRadius: 16,
  },
  shareBarCount: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: "#fff" },
  shareBarBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.teal, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 11 },
  shareBarBtnText: { fontFamily: fonts.bodyBold, fontSize: 12, color: "#052B26" },
});
