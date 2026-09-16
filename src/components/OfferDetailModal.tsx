import React from "react";
import { Modal, Pressable, Share, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { LiveOffer } from "@/services/offers";

interface Props {
  offer: LiveOffer | null;
  onClose: () => void;
}

async function shareOffer(offer: LiveOffer) {
  const lines = [
    `${offer.pct} at ${offer.merchant}`,
    offer.desc,
    offer.exp,
    "",
    "Sent via SnapBill",
  ];
  try {
    await Share.share({ message: lines.join("\n"), title: `${offer.pct} — ${offer.merchant}` });
  } catch {
    /* user dismissed */
  }
}

/** Tap-to-open detail sheet for a live, personalized offer in a folder's Offers column. */
export function OfferDetailModal({ offer, onClose }: Props) {
  return (
    <Modal visible={!!offer} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {offer && (
            <>
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

              <Pressable style={styles.shareBtn} onPress={() => shareOffer(offer)}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 3v13M8 7l4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={styles.shareBtnText}>Share this offer</Text>
              </Pressable>
              <Text style={styles.hint}>Show this screen to the cashier, or share it — email, WhatsApp, Messages, or Save to Files.</Text>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(11,37,69,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 30 },
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
  shareBtn: {
    marginTop: 20,
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
