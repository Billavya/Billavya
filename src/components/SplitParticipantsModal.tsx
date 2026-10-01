import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { formatINR } from "@/data/folders";
import { SplitParticipant } from "@/services/invoices";

interface Props {
  visible: boolean;
  merchant: string;
  yourShare: number;
  splitCount: number;
  people: SplitParticipant[];
  onClose: () => void;
}

/**
 * Opened by tapping the "Your share" banner on a split invoice — a nested
 * sheet on top of InvoiceDetailModal, not a full navigation away from it.
 * Its own back button just calls onClose(), which hides this sheet and
 * reveals InvoiceDetailModal again underneath (it was never closed) — that's
 * the whole mechanism for "back returns you to the invoice".
 *
 * Same structure as every other sheet in this app: the overlay is a plain
 * View, and tap-to-dismiss is a separate sibling Pressable covering only the
 * space above the sheet, so it never blocks a scroll gesture on the list.
 */
export function SplitParticipantsModal({ visible, merchant, yourShare, splitCount, people, onClose }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.dismissZone} onPress={onClose} />
        <View style={styles.sheet}>
          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + insets.bottom }]}
            showsVerticalScrollIndicator
          >
            <Pressable style={styles.backBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Back to invoice">
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M15 5 8 12l7 7" stroke={colors.navy} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>

            <Text style={styles.title}>Split {splitCount} ways</Text>
            <Text style={styles.subtitle}>{merchant}</Text>

            <View style={styles.list}>
              <View style={styles.row}>
                <View style={[styles.avatar, styles.avatarYou]}>
                  <Text style={styles.avatarText}>Y</Text>
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  You
                </Text>
                <Text style={styles.amount}>{formatINR(yourShare)}</Text>
              </View>

              {people.map((p, i) => (
                <View key={i} style={styles.row}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{p.name[0]?.toUpperCase() ?? "?"}</Text>
                  </View>
                  <Text style={styles.name} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={styles.amount}>{formatINR(p.share)}</Text>
                </View>
              ))}
            </View>

            {people.length === 0 && (
              <Text style={styles.empty}>
                No names were saved for this split — it may have been sent before this list existed.
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(11,37,69,0.45)" },
  dismissZone: { flex: 1 },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  scrollBody: { maxHeight: "80%" },
  scrollContent: { padding: 20 },
  backBtn: {
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
  title: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.navy, textAlign: "center" },
  subtitle: { marginTop: 4, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.muted, textAlign: "center" },
  list: { marginTop: 20, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 11 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" },
  avatarYou: { backgroundColor: colors.teal },
  avatarText: { fontFamily: fonts.displayBold, fontSize: 14, color: "#fff" },
  name: { flex: 1, minWidth: 0, fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.navy2 },
  amount: { fontFamily: fonts.displayBold, fontSize: 14.5, color: colors.navy },
  empty: { marginTop: 24, textAlign: "center", fontFamily: fonts.bodyMedium, fontSize: 12.5, lineHeight: 18, color: colors.muted2 },
});
