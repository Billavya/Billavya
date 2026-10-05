import React, { useEffect, useMemo, useState } from "react";
import { Dimensions, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { formatINR } from "@/data/folders";
import { LiveInvoice, setInvoiceFavorite, setInvoiceGift, setInvoiceOtherFolder, setInvoiceSplit, setInvoiceWarranty, SplitParticipant, transferInvoice } from "@/services/invoices";
import { getOffersForCustomer, LiveOffer } from "@/services/offers";
import { OtherFolder, subscribeOtherFolders } from "@/services/otherFolders";
import { bestEligibleOffer, OfferEligibility } from "@/utils/offerEligibility";
import { ContactPickerModal } from "@/components/ContactPickerModal";
import { SplitParticipantsModal } from "@/components/SplitParticipantsModal";
import { OtherFolderPickerModal } from "@/components/OtherFolderPickerModal";
import { Contact } from "@/data/contacts";
import { useToast } from "@/components/Toast";
import { LOCALE } from "@/config/locale";

interface Props {
  invoice: LiveInvoice | null;
  onClose: () => void;
}

type Tab = "split" | "transfer" | null;

// Deliberately the ONLY height constraint in this whole tree — the sheet
// itself is left auto-height (no maxHeight of its own), so there's no
// parent/child flex negotiation for Yoga to get wrong. A hard numeric
// maxHeight directly on the scrollable leaf always clips to exactly this,
// full stop, which is what makes a long invoice's Share/Split/Transfer row
// reachable by scrolling instead of running off the bottom of the screen.
const MAX_SCROLL_HEIGHT = Math.round(Dimensions.get("window").height * 0.8);

async function shareText(title: string, message: string) {
  try {
    await Share.share({ message, title });
  } catch {
    /* user dismissed */
  }
}

function invoiceShareText(inv: LiveInvoice) {
  const lines = [
    `Avyaya Invoice ${inv.invoiceNo || ""}`.trim(),
    `${inv.merchant}${inv.date ? " — " + inv.date : ""}`,
    ...(inv.merchantAddress ? [inv.merchantAddress] : []),
    ...(inv.gstin ? [`GSTIN: ${inv.gstin}`] : []),
    "",
    ...(inv.items || []).map(
      (it) => `• ${it.name}${it.variant ? ` (${it.variant})` : ""} × ${it.qty} — ${formatINR(it.unit * it.qty)}`
    ),
    "",
    `Total paid: ${formatINR(inv.total)}`,
    "Sent via Avyaya",
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
  // On any iPhone without a physical home button, the gesture bar sits in a
  // ~34pt safe area that isn't part of Dimensions.get("window") at all — a
  // flat guessed paddingBottom left the last row (Share/Split/Transfer, or
  // whatever a tab expanded below them) rendered right under/behind it,
  // genuinely unreachable by scrolling on a real device. This never showed
  // up testing on a desktop browser preview, which has no such inset.
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>(null);

  const [splitAmountText, setSplitAmountText] = useState("");
  const [splitCount, setSplitCount] = useState(2);
  const [splitPeople, setSplitPeople] = useState<Contact[]>([]);
  const [splitPickerOpen, setSplitPickerOpen] = useState(false);

  const [transferPickerOpen, setTransferPickerOpen] = useState(false);
  const [pendingTransfer, setPendingTransfer] = useState<Contact | null>(null);
  const [transferBusy, setTransferBusy] = useState(false);
  // undefined = no local override yet, defer to the invoice's own field
  const [localTransferredTo, setLocalTransferredTo] = useState<string | null | undefined>(undefined);
  const [localFavorite, setLocalFavorite] = useState<boolean | undefined>(undefined);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [localGift, setLocalGift] = useState<boolean | undefined>(undefined);
  const [localWarranty, setLocalWarranty] = useState<boolean | undefined>(undefined);
  // undefined = no local override yet, defer to the invoice's own field.
  // null is a real value here (explicitly filed out of Other), distinct
  // from undefined (not touched this session) — same three-state pattern
  // as localTransferredTo above.
  const [localOtherFolderId, setLocalOtherFolderId] = useState<string | null | undefined>(undefined);
  const [otherFolders, setOtherFolders] = useState<OtherFolder[]>([]);
  const [otherPickerOpen, setOtherPickerOpen] = useState(false);
  const [tagBusy, setTagBusy] = useState(false);
  // undefined = no local override yet, defer to the invoice's own fields —
  // same pattern as localTransferredTo, so the Split banner below appears
  // instantly on send instead of waiting for Firestore's round-trip.
  const [localSplitInfo, setLocalSplitInfo] = useState<
    { yourShare: number; splitCount: number; people: SplitParticipant[] } | null | undefined
  >(undefined);
  // Opens the "who else was in this split" sheet on top of this modal — its
  // own back button just closes it, revealing this invoice again underneath.
  const [splitParticipantsOpen, setSplitParticipantsOpen] = useState(false);

  // Whether an offer the customer already activated actually applies to
  // THIS invoice as it stands — same eligibility check the POS runs at bill
  // time (category restriction, minimum spend, a matching item actually
  // being on it), just run here against an invoice already in a folder
  // instead of a cart at the counter. undefined = hasn't finished checking
  // yet for this invoice, so the banner below only ever flashes in once
  // (never flickers between invoices while a previous one's result is
  // still showing).
  const [eligibleOffer, setEligibleOffer] = useState<
    { offer: LiveOffer; eligibility: OfferEligibility } | null | undefined
  >(undefined);

  useEffect(() => {
    if (!invoice) return;
    setTab(null);
    setSplitAmountText(String(invoice.total));
    setSplitCount(2);
    setSplitPeople([]);
    setPendingTransfer(null);
    setLocalTransferredTo(undefined);
    setLocalFavorite(undefined);
    setLocalGift(undefined);
    setLocalWarranty(undefined);
    setLocalOtherFolderId(undefined);
    setOtherPickerOpen(false);
    setLocalSplitInfo(undefined);
    setSplitParticipantsOpen(false);
    setEligibleOffer(undefined);

    let cancelled = false;
    getOffersForCustomer(invoice.avyayaId, LOCALE.country).then((offers) => {
      if (cancelled) return;
      setEligibleOffer(bestEligibleOffer(offers, invoice.merchant, invoice.items, invoice.subtotal ?? invoice.total));
    });
    return () => {
      cancelled = true;
    };
  }, [invoice?.id]);

  useEffect(() => {
    if (!invoice?.avyayaId) return;
    return subscribeOtherFolders(invoice.avyayaId, setOtherFolders);
  }, [invoice?.avyayaId]);

  const isFavorite = localFavorite !== undefined ? localFavorite : !!invoice?.favorite;
  const isGift = localGift !== undefined ? localGift : !!invoice?.giftLabel;
  const isWarranty = localWarranty !== undefined ? localWarranty : !!invoice?.warranty;
  const currentOtherFolderId =
    localOtherFolderId !== undefined ? localOtherFolderId : invoice?.otherFolderId ?? null;
  // otherLabel can be true with no folder id (tagged before subfolders
  // existed, or filed without picking one) — still shown as "on", just with
  // the generic "Other" label, resolved in Exclusive → Others → Unfiled.
  const isOther = currentOtherFolderId != null || (localOtherFolderId === undefined && !!invoice?.otherLabel);
  const currentOtherFolder = currentOtherFolderId ? otherFolders.find((f) => f.id === currentOtherFolderId) : null;
  // The chip reads the assigned folder's own name once one is set (e.g.
  // "Business 1") — only "Other" by itself as the default, before anything
  // has been picked.
  const otherChipLabel = currentOtherFolder ? currentOtherFolder.name : "Other";

  async function toggleFavorite() {
    if (!invoice || favoriteBusy) return;
    const next = !isFavorite;
    setLocalFavorite(next);
    setFavoriteBusy(true);
    try {
      await setInvoiceFavorite(invoice.id, next);
    } catch {
      setLocalFavorite(!next);
      showToast("Couldn't update favorite — check your connection");
    } finally {
      setFavoriteBusy(false);
    }
  }

  async function toggleGift() {
    if (!invoice || tagBusy) return;
    const next = !isGift;
    setLocalGift(next);
    setTagBusy(true);
    try {
      await setInvoiceGift(invoice.id, next);
      showToast(next ? "Marked as a gift — see it in Exclusive" : "Removed gift label");
    } catch {
      setLocalGift(!next);
      showToast("Couldn't update — check your connection");
    } finally {
      setTagBusy(false);
    }
  }

  async function toggleWarranty() {
    if (!invoice || tagBusy) return;
    const next = !isWarranty;
    setLocalWarranty(next);
    setTagBusy(true);
    try {
      await setInvoiceWarranty(invoice.id, next);
      showToast(next ? "Marked as under warranty — see it in Exclusive" : "Removed warranty label");
    } catch {
      setLocalWarranty(!next);
      showToast("Couldn't update — check your connection");
    } finally {
      setTagBusy(false);
    }
  }

  async function handleOtherFolderSelect(folder: OtherFolder | null) {
    if (!invoice || tagBusy) return;
    setOtherPickerOpen(false);
    const prev = currentOtherFolderId;
    const nextId = folder?.id ?? null;
    setLocalOtherFolderId(nextId);
    setTagBusy(true);
    try {
      await setInvoiceOtherFolder(invoice.id, nextId);
      showToast(folder ? `Filed under "${folder.name}" — see it in Exclusive → Others` : "Removed from Other");
    } catch {
      setLocalOtherFolderId(prev);
      showToast("Couldn't update — check your connection");
    } finally {
      setTagBusy(false);
    }
  }

  const transferredTo = localTransferredTo !== undefined ? localTransferredTo : invoice?.transferredTo ?? null;
  const splitInfo =
    localSplitInfo !== undefined
      ? localSplitInfo
      : invoice?.splitYourShare != null
      ? { yourShare: invoice.splitYourShare, splitCount: invoice.splitCount ?? 0, people: invoice.splitPeople ?? [] }
      : null;

  const splitTotal = Math.max(0, parseInt(splitAmountText, 10) || 0);
  // splitCount is the TOTAL number of people sharing the bill, including you
  // — so shares[0] is your own portion, and shares[1..] map to the
  // splitCount-1 friends you actually need to pick from the contact list.
  const shares = useMemo(() => computeShares(splitTotal, splitCount), [splitTotal, splitCount]);
  const friendsNeeded = Math.max(0, splitCount - 1);
  const splitReady = splitPeople.length === friendsNeeded && friendsNeeded > 0;

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
      `• You: ${formatINR(shares[0])}`,
      ...splitPeople.map((p, i) => `• ${p.name}: ${formatINR(shares[i + 1])}`),
      "",
      "Sent via Avyaya",
    ];
    await shareText(`Split — Invoice ${invoice.invoiceNo || ""}`.trim(), lines.join("\n"));
    // Record the split on the invoice itself — shows as a banner here, and
    // cross-references this invoice in Special → Split, same as Transfer does.
    const people: SplitParticipant[] = splitPeople.map((p, i) => ({ name: p.name, share: shares[i + 1] }));
    setLocalSplitInfo({ yourShare: shares[0], splitCount, people });
    try {
      await setInvoiceSplit(invoice.id, shares[0], splitCount, people);
    } catch {
      showToast("Split sent, but couldn't save it to the invoice — check your connection");
    }
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
      {/* overlay is a plain View now, NOT a Pressable — a full-screen
          Pressable sat directly on top of the sheet/ScrollView too, and its
          touch-responder claim was winning against the ScrollView's native
          scroll gesture no matter what the sheet itself was wrapped in.
          "Tap outside to dismiss" is now its own small Pressable that only
          occupies the space ABOVE the sheet — a true sibling, not an
          ancestor — so it never overlaps the ScrollView's touch area at
          all, and there's nothing left to compete with. */}
      <View style={styles.overlay}>
        <Pressable style={styles.dismissZone} onPress={onClose} />
        <View style={styles.sheet}>
          {invoice && (
            <ScrollView
              style={styles.scrollBody}
              contentContainerStyle={[styles.scrollContent, { paddingBottom: 30 + insets.bottom }]}
              showsVerticalScrollIndicator
              persistentScrollbar
            >
              <Pressable style={styles.backCenterBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Back">
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M15 5 8 12l7 7" stroke={colors.navy} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </Pressable>
              <Pressable
                style={styles.favoriteBtn}
                onPress={toggleFavorite}
                accessibilityRole="button"
                accessibilityLabel={isFavorite ? "Remove from favorites" : "Mark as favorite"}
              >
                <Svg width={20} height={20} viewBox="0 0 24 24" fill={isFavorite ? colors.teal : "none"}>
                  <Path
                    d="m12 3 2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L12 17l-5.6 3.1 1.4-6.3-4.8-4.3 6.4-.6L12 3Z"
                    stroke={isFavorite ? colors.teal : colors.muted2}
                    strokeWidth={1.8}
                    strokeLinejoin="round"
                  />
                </Svg>
              </Pressable>
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

              {/* Same banner treatment as "Transferred" above — teal instead
                  of red, since splitting isn't a loss the way handing an
                  invoice away is: you still paid the full bill, this is just
                  a record of who owes you what. Tappable — opens who else
                  was in on it. */}
              {splitInfo && (
                <Pressable style={styles.splitBanner} onPress={() => setSplitParticipantsOpen(true)}>
                  <Text style={styles.splitBannerText}>
                    Your share: {formatINR(splitInfo.yourShare)} · split among {splitInfo.splitCount} people
                  </Text>
                  <Text style={styles.splitBannerChevron}>›</Text>
                </Pressable>
              )}

              {/* This invoice already qualifies for an offer the customer
                  activated — same eligibility check the POS runs at bill
                  time, just surfaced here after the fact. Silent (no banner
                  at all) when nothing applies, rather than a discouraging
                  "no offer" message on every ordinary invoice. */}
              {eligibleOffer && (
                <View style={styles.offerBanner}>
                  <Text style={styles.offerBannerTitle}>🎁 {eligibleOffer.offer.pct} applied</Text>
                  <Text style={styles.offerBannerNote}>{eligibleOffer.eligibility.note}</Text>
                  {!!eligibleOffer.offer.criterion && (
                    <Text style={styles.offerBannerSub}>{eligibleOffer.offer.criterion}</Text>
                  )}
                </View>
              )}

              <View style={styles.tagChipRow}>
                <Pressable style={[styles.tagChip, isGift && styles.tagChipOn]} onPress={toggleGift} disabled={tagBusy}>
                  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                    <Rect x="3.5" y="9" width="17" height="10" rx="1.2" stroke={isGift ? "#fff" : colors.navy2} strokeWidth={1.8} />
                    <Rect x="3.5" y="6" width="17" height="4" rx="1" stroke={isGift ? "#fff" : colors.navy2} strokeWidth={1.8} />
                    <Path d="M12 6v13" stroke={isGift ? "#fff" : colors.navy2} strokeWidth={1.8} />
                    <Path
                      d="M12 6c-1.5-3-5-3-5-.5S9.5 6 12 6ZM12 6c1.5-3 5-3 5-.5S14.5 6 12 6Z"
                      stroke={isGift ? "#fff" : colors.navy2}
                      strokeWidth={1.6}
                      strokeLinejoin="round"
                    />
                  </Svg>
                  <Text style={[styles.tagChipText, isGift && styles.tagChipTextOn]}>Gift</Text>
                </Pressable>
                <Pressable style={[styles.tagChip, isWarranty && styles.tagChipOn]} onPress={toggleWarranty} disabled={tagBusy}>
                  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M12 3 5 6v5c0 4.2 3 7.5 7 9 4-1.5 7-4.8 7-9V6l-7-3Z"
                      stroke={isWarranty ? "#fff" : colors.navy2}
                      strokeWidth={1.8}
                      strokeLinejoin="round"
                    />
                    <Path d="M9 12l2 2 4-4" stroke={isWarranty ? "#fff" : colors.navy2} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={[styles.tagChipText, isWarranty && styles.tagChipTextOn]}>Warranty</Text>
                </Pressable>
                <Pressable style={[styles.tagChip, isOther && styles.tagChipOn]} onPress={() => setOtherPickerOpen(true)} disabled={tagBusy}>
                  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                    <Path d="M11 4H5a1 1 0 0 0-1 1v6l9 9 7-7-9-9Z" stroke={isOther ? "#fff" : colors.navy2} strokeWidth={1.8} strokeLinejoin="round" />
                    <Circle cx="7.5" cy="7.5" r="1.2" fill={isOther ? "#fff" : colors.navy2} />
                  </Svg>
                  <Text style={[styles.tagChipText, isOther && styles.tagChipTextOn]} numberOfLines={1}>{otherChipLabel}</Text>
                </Pressable>
              </View>
              {(isGift || isWarranty || isOther) && <Text style={styles.exclusiveHint}>Also shows up in your Exclusive folder.</Text>}

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

              <Text style={styles.actionsLabel}>ACTIONS</Text>
              <View style={styles.actionRow}>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => shareText(`Avyaya Invoice ${invoice.invoiceNo || ""}`.trim(), invoiceShareText(invoice))}
                  accessibilityRole="button"
                  accessibilityLabel="Share this invoice"
                >
                  <View style={styles.actionIconWrap}>
                    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                      <Path d="M12 3v13M8 7l4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" stroke={colors.tealDark} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </View>
                  <Text style={styles.actionBtnText}>Share</Text>
                </Pressable>

                <Pressable
                  style={[styles.actionBtn, tab === "split" && styles.actionBtnActive]}
                  onPress={() => setTab((t) => (t === "split" ? null : "split"))}
                  accessibilityRole="button"
                  accessibilityLabel="Split this invoice"
                >
                  <View style={[styles.actionIconWrap, tab === "split" && styles.actionIconWrapActive]}>
                    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M12 3v6M8 6l4 3 4-3M6 21v-6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6"
                        stroke={tab === "split" ? "#fff" : colors.tealDark}
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </View>
                  <Text style={[styles.actionBtnText, tab === "split" && styles.actionBtnTextActive]}>Split</Text>
                </Pressable>

                <Pressable
                  style={[styles.actionBtn, tab === "transfer" && styles.actionBtnActive]}
                  onPress={() => setTab((t) => (t === "transfer" ? null : "transfer"))}
                  accessibilityRole="button"
                  accessibilityLabel="Transfer this invoice"
                >
                  <View style={[styles.actionIconWrap, tab === "transfer" && styles.actionIconWrapActive]}>
                    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M4 12h12M12 6l6 6-6 6"
                        stroke={tab === "transfer" ? "#fff" : colors.tealDark}
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </View>
                  <Text style={[styles.actionBtnText, tab === "transfer" && styles.actionBtnTextActive]}>Transfer</Text>
                </Pressable>
              </View>

              {tab === "split" && (
                <View style={styles.tabBody}>
                  <Text style={styles.fieldLabel}>Amount to split</Text>
                  <View style={styles.amountField}>
                    <Text style={styles.amountPrefix}>{LOCALE.currencySymbol}</Text>
                    <TextInput
                      style={styles.amountInput}
                      value={splitAmountText}
                      onChangeText={setSplitAmountText}
                      keyboardType="number-pad"
                    />
                  </View>

                  <Text style={styles.fieldLabel}>Split between (including you)</Text>
                  <View style={styles.stepperRow}>
                    <Pressable style={styles.stepperBtn} onPress={() => adjustSplitCount(-1)}>
                      <Text style={styles.stepperBtnText}>−</Text>
                    </Pressable>
                    <Text style={styles.stepperValue}>{splitCount} people</Text>
                    <Pressable style={styles.stepperBtn} onPress={() => adjustSplitCount(1)}>
                      <Text style={styles.stepperBtnText}>+</Text>
                    </Pressable>
                  </View>

                  <View style={styles.yourShareBox}>
                    <Text style={styles.yourShareText}>
                      Your share is <Text style={styles.yourShareAmount}>{formatINR(shares[0])}</Text> — the rest
                      splits across {friendsNeeded} friend{friendsNeeded === 1 ? "" : "s"}.
                    </Text>
                  </View>

                  <Pressable style={styles.secondaryBtn} onPress={() => setSplitPickerOpen(true)}>
                    <Text style={styles.secondaryBtnText}>
                      {splitPeople.length === 0
                        ? `Select ${friendsNeeded} friend${friendsNeeded === 1 ? "" : "s"}`
                        : `${splitPeople.length}/${friendsNeeded} friends selected — change`}
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
                          <Text style={styles.splitShare}>{formatINR(shares[i + 1])}</Text>
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
        </View>
      </View>

      <ContactPickerModal
        visible={splitPickerOpen}
        mode="multi"
        limit={friendsNeeded}
        title={`Select ${friendsNeeded} friend${friendsNeeded === 1 ? "" : "s"}`}
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
      {splitInfo && invoice && (
        <SplitParticipantsModal
          visible={splitParticipantsOpen}
          merchant={invoice.merchant}
          yourShare={splitInfo.yourShare}
          splitCount={splitInfo.splitCount}
          people={splitInfo.people}
          onClose={() => setSplitParticipantsOpen(false)}
        />
      )}
      <OtherFolderPickerModal
        visible={otherPickerOpen}
        avyayaId={invoice?.avyayaId ?? null}
        currentFolderId={currentOtherFolderId}
        onClose={() => setOtherPickerOpen(false)}
        onSelect={handleOtherFolderSelect}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(11,37,69,0.45)" },
  // Fills all space above the sheet and dismisses on tap — a sibling of the
  // sheet, not a wrapper around it, so it can never overlap (and steal
  // touches from) the ScrollView inside the sheet.
  dismissZone: { flex: 1 },
  // No padding here on purpose — it now lives on scrollContent instead, so
  // the ScrollView's own touchable area fills this box edge-to-edge with
  // nothing left uncovered.
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  // The sheet itself has NO maxHeight — its size is just whatever this
  // ScrollView ends up being. The ScrollView's own hard maxHeight is the
  // single source of truth for how tall this can ever get.
  scrollBody: { maxHeight: MAX_SCROLL_HEIGHT },
  scrollContent: { padding: 20, paddingBottom: 30 },
  // TEMPORARY — remove with the debug state once this is fixed.
  backCenterBtn: {
    alignSelf: "center",
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.appBg,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  favoriteBtn: { position: "absolute", top: 12, right: 16, padding: 6, zIndex: 2 },
  title: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.navy },
  merchant: { marginTop: 4, fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.navy2 },
  address: { marginTop: 2, fontFamily: fonts.bodyRegular, fontSize: 11.5, lineHeight: 15.5, color: colors.navy2 },
  meta: { marginTop: 4, fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.navy2 },

  transferredBanner: { marginTop: 10, backgroundColor: colors.dangerTint, borderWidth: 1, borderColor: colors.dangerLine, borderRadius: 10, padding: 8 },
  transferredBannerText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.dangerDark },
  splitBanner: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.tealTint,
    borderWidth: 1,
    borderColor: colors.teal,
    borderRadius: 10,
    padding: 8,
  },
  splitBannerText: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.tealDark },
  splitBannerChevron: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.tealDark },

  // Same amber treatment as the POS's own offer banner, so a customer who's
  // seen it applied at the counter recognizes it here too.
  offerBanner: { marginTop: 10, backgroundColor: colors.amberTint2, borderWidth: 1, borderColor: colors.amberLine, borderRadius: 10, padding: 10 },
  offerBannerTitle: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.amberInk },
  offerBannerNote: { marginTop: 2, fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.amberInk2 },
  offerBannerSub: { marginTop: 3, fontFamily: fonts.bodyRegular, fontSize: 10.5, color: colors.amberInk2, opacity: 0.85 },

  tagChipRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.appBg,
  },
  tagChipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  tagChipText: { fontFamily: fonts.bodySemibold, fontSize: 12.5, color: colors.navy2 },
  tagChipTextOn: { color: "#fff" },
  exclusiveHint: { marginTop: 6, fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.tealDark },

  itemsBox: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line, borderStyle: "dashed", gap: 8 },
  itemRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  itemName: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.navy2 },
  itemVariant: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.navy2 },
  itemAmt: { fontFamily: fonts.displayBold, fontSize: 12, color: colors.navy },
  totals: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line, borderStyle: "dashed" },
  totRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totLabel: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.navy2 },
  totVal: { fontFamily: fonts.bodySemibold, fontSize: 12.5, color: colors.navy2 },
  grand: { marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line },
  grandLabel: { fontFamily: fonts.displayBold, fontSize: 15.5, color: colors.navy },
  grandVal: { fontFamily: fonts.displayBold, fontSize: 15.5, color: colors.navy },

  actionsLabel: { marginTop: 16, fontFamily: fonts.bodyBold, fontSize: 11.5, letterSpacing: 0.6, color: colors.muted2 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 7 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  actionBtnActive: { borderColor: colors.teal, backgroundColor: colors.tealTint },
  actionIconWrap: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.tealTint, alignItems: "center", justifyContent: "center" },
  actionIconWrapActive: { backgroundColor: colors.teal },
  actionBtnText: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.navy2 },
  actionBtnTextActive: { color: colors.tealDark },
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
  primaryBtnText: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: "#fff" },
  hint: { marginTop: 10, fontFamily: fonts.bodyRegular, fontSize: 11.5, lineHeight: 16.5, color: colors.navy2, textAlign: "center" },

  fieldLabel: { fontFamily: fonts.bodyBold, fontSize: 11.5, letterSpacing: 0.4, textTransform: "uppercase", color: colors.muted2, marginTop: 12, marginBottom: 6 },
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
  amountPrefix: { fontFamily: fonts.displayBold, fontSize: 16.5, color: colors.navy },
  amountInput: { flex: 1, fontFamily: fonts.displayBold, fontSize: 16.5, color: colors.navy, padding: 0 },
  stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, backgroundColor: colors.appBg, borderRadius: 12, paddingVertical: 8 },
  stepperBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  stepperBtnText: { fontFamily: fonts.bodyBold, fontSize: 19, color: colors.navy },
  stepperValue: { fontFamily: fonts.displayBold, fontSize: 14.5, color: colors.navy2, minWidth: 76, textAlign: "center" },

  // Same highlighted-sentence-in-a-box treatment as the Transfer tab's
  // confirmBox/confirmAmount below — just in the app's positive teal, since
  // "here's your share" is informational, not a warning like a transfer is.
  yourShareBox: { marginTop: 12, backgroundColor: colors.tealTint, borderWidth: 1, borderColor: colors.teal, borderRadius: 12, padding: 12 },
  yourShareText: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 19, color: colors.tealDark },
  yourShareAmount: { fontFamily: fonts.displayBold, fontSize: 15, color: colors.navy },

  secondaryBtn: { marginTop: 12, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: colors.teal, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.tealDark },

  splitBreakdown: { marginTop: 14, gap: 8 },
  splitRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  splitAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" },
  splitAvatarText: { fontFamily: fonts.displayBold, fontSize: 12, color: colors.teal },
  splitName: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.navy2 },
  splitShare: { fontFamily: fonts.displayBold, fontSize: 13, color: colors.navy },
  splitFormula: { marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line, borderStyle: "dashed" },
  splitFormulaText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted2, textAlign: "center" },

  transferCopy: { fontFamily: fonts.bodyRegular, fontSize: 13, lineHeight: 19, color: colors.navy2 },
  confirmBox: { backgroundColor: colors.dangerTint, borderWidth: 1, borderColor: colors.dangerLine, borderRadius: 12, padding: 12 },
  confirmText: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 19, color: colors.dangerDeep },
  confirmAmount: { fontFamily: fonts.bodyBold, color: colors.dangerDeep },
  confirmName: { fontFamily: fonts.bodyBold, color: colors.dangerDeep },
  confirmRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  cancelBtn: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  cancelBtnText: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.navy2 },
  dangerBtn: { flex: 1, height: 44, borderRadius: 12, backgroundColor: colors.dangerBright, alignItems: "center", justifyContent: "center" },
  dangerBtnText: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: "#fff" },
  transferStatus: { backgroundColor: colors.dangerTint, borderWidth: 1, borderColor: colors.dangerLine, borderRadius: 12, padding: 12 },
  transferStatusText: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 19, color: colors.dangerDeep },
  transferStatusName: { fontFamily: fonts.bodyBold },
});
