import React, { useEffect, useState } from "react";
import { Dimensions, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { LiveOffer, setOfferActivated } from "@/services/offers";
import { useToast } from "@/components/Toast";

interface Props {
  offer: LiveOffer | null;
  onClose: () => void;
}

// See InvoiceDetailModal for why this needs a real computed pixel height —
// a plain percentage maxHeight plus flexShrink isn't enough on its own.
const MAX_SHEET_HEIGHT = Math.round(Dimensions.get("window").height * 0.86);

async function shareOffer(offer: LiveOffer, code: string) {
  const lines = [
    `${offer.pct} at ${offer.merchant}`,
    offer.desc,
    offer.exp,
    "",
    `Activation code: ${code}`,
    "Sent via SnapBill",
  ];
  try {
    await Share.share({ message: lines.join("\n"), title: `${offer.pct} — ${offer.merchant}` });
  } catch {
    /* user dismissed */
  }
}

/** A short, stable-looking redemption code derived from the offer's own id. */
function activationCode(offerId: string): string {
  return "AVL-" + offerId.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase();
}

/** Tap-to-open detail sheet for a live, personalized offer — view it, share it, or activate it. */
export function OfferDetailModal({ offer, onClose }: Props) {
  const { showToast } = useToast();
  const [localActivated, setLocalActivated] = useState<boolean | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLocalActivated(undefined);
  }, [offer?.id]);

  const isActivated = localActivated !== undefined ? localActivated : !!offer?.activated;

  async function activate() {
    if (!offer || busy) return;
    setLocalActivated(true);
    setBusy(true);
    try {
      await setOfferActivated(offer.id, true);
      showToast("Offer activated — show this screen to redeem");
    } catch {
      setLocalActivated(false);
      showToast("Couldn't activate — check your connection");
    } finally {
      setBusy(false);
    }
  }

  async function undoActivate() {
    if (!offer || busy) return;
    setLocalActivated(false);
    setBusy(true);
    try {
      await setOfferActivated(offer.id, false);
    } catch {
      setLocalActivated(true);
      showToast("Couldn't undo — check your connection");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={!!offer} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {offer && (
            <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator persistentScrollbar>
              <Pressable style={styles.backCenterBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Back">
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M15 5 8 12l7 7" stroke={colors.navy} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </Pressable>

              <View style={styles.forYouTag}>
                <Text style={styles.forYouTagText}>FOR YOU</Text>
              </View>

              <Text style={styles.pct}>{offer.pct}</Text>
              <Text style={styles.merchant}>{offer.merchant}</Text>
              <Text style={styles.desc}>{offer.desc}</Text>

              <View style={styles.expRow}>
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                  <Circle cx="12" cy="12" r="9" stroke={colors.amberInk2} strokeWidth={1.8} />
                  <Path d="M12 7v5l3 2" stroke={colors.amberInk2} strokeWidth={1.8} strokeLinecap="round" />
                </Svg>
                <Text style={styles.expText}>{offer.exp}</Text>
              </View>

              {!!offer.criterion && (
                <View style={styles.whyBox}>
                  <Text style={styles.whyLabel}>WHY YOU GOT THIS</Text>
                  <Text style={styles.whyText}>{offer.criterion}</Text>
                </View>
              )}

              {isActivated ? (
                <View style={styles.activatedBox}>
                  <View style={styles.activatedHead}>
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                      <Path d="M5 13l4 4L19 7" stroke={colors.tealDark} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={styles.activatedTitle}>Activated — ready to redeem</Text>
                  </View>
                  <Text style={styles.activatedCode}>{activationCode(offer.id)}</Text>
                  <Text style={styles.activatedHint}>Show this screen to the cashier at {offer.merchant}.</Text>
                  <Pressable onPress={undoActivate} disabled={busy}>
                    <Text style={styles.undoLink}>{busy ? "Undoing…" : "Undo activation"}</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable style={[styles.activateBtn, busy && styles.btnDisabled]} onPress={activate} disabled={busy}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={styles.activateBtnText}>{busy ? "Activating…" : "Activate offer"}</Text>
                </Pressable>
              )}

              <Pressable style={styles.shareBtn} onPress={() => shareOffer(offer, activationCode(offer.id))}>
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 3v13M8 7l4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" stroke={colors.navy2} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={styles.shareBtnText}>Share this offer</Text>
              </Pressable>
              <Text style={styles.hint}>Activating gives you a code to redeem at checkout — sharing sends it to someone else.</Text>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(11,37,69,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 30, maxHeight: MAX_SHEET_HEIGHT },
  // Offer copy length varies a lot per campaign/customer — cap the sheet and
  // let this scroll instead of running offscreen on longer descriptions.
  scrollBody: { flexShrink: 1, minHeight: 0, maxHeight: MAX_SHEET_HEIGHT - 60 },
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
    marginBottom: 14,
  },
  forYouTag: { alignSelf: "flex-start", backgroundColor: colors.teal, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginBottom: 10 },
  forYouTagText: { fontFamily: fonts.bodyBold, fontSize: 9, color: "#fff", letterSpacing: 0.5 },
  pct: {
    alignSelf: "flex-start",
    fontFamily: fonts.displayExtraBold,
    fontSize: 15,
    color: colors.amberInk,
    backgroundColor: colors.amberLine,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 10,
    overflow: "hidden",
  },
  merchant: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.navy },
  desc: { marginTop: 6, fontFamily: fonts.bodyRegular, fontSize: 13, lineHeight: 19, color: colors.navy2 },
  expRow: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 5 },
  expText: { fontFamily: fonts.bodySemibold, fontSize: 11.5, color: colors.amberInk2 },
  whyBox: { marginTop: 16, backgroundColor: colors.appBg, borderRadius: 12, padding: 12 },
  whyLabel: { fontFamily: fonts.bodyBold, fontSize: 9.5, letterSpacing: 0.6, color: colors.muted2, marginBottom: 4 },
  whyText: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 17, color: colors.navy2 },

  activateBtn: {
    marginTop: 18,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.teal,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  btnDisabled: { opacity: 0.6 },
  activateBtnText: { fontFamily: fonts.bodyBold, fontSize: 14, color: "#052B26" },

  activatedBox: { marginTop: 18, backgroundColor: colors.tealTint, borderWidth: 1.5, borderColor: colors.teal, borderRadius: 14, padding: 14, alignItems: "center" },
  activatedHead: { flexDirection: "row", alignItems: "center", gap: 7 },
  activatedTitle: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.tealDark },
  activatedCode: { marginTop: 10, fontFamily: fonts.displayExtraBold, fontSize: 20, letterSpacing: 2, color: colors.navy },
  activatedHint: { marginTop: 6, fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.tealDark, textAlign: "center" },
  undoLink: { marginTop: 10, fontFamily: fonts.bodySemibold, fontSize: 10.5, color: colors.muted2, textDecorationLine: "underline" },

  shareBtn: {
    marginTop: 10,
    height: 44,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  shareBtnText: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.navy2 },
  hint: { marginTop: 10, fontFamily: fonts.bodyRegular, fontSize: 10.5, lineHeight: 15, color: colors.navy2, textAlign: "center" },
});
