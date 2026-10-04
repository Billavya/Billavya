import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { CountryCode, LOCALES } from "@/config/locale";

interface CountryOption {
  code: CountryCode;
  flag: string;
  name: string;
}

const COUNTRIES: CountryOption[] = [
  { code: "India", flag: "🇮🇳", name: "India" },
  { code: "Canada", flag: "🇨🇦", name: "Canada" },
];

interface Props {
  visible: boolean;
  current: CountryCode;
  onClose: () => void;
  onSelect: (country: CountryCode) => void;
}

/**
 * Same Modal structure as every other sheet in this app (see
 * DatePickerModal/InvoiceDetailModal): a plain overlay View, a separate
 * sibling Pressable for tap-outside-to-dismiss, and the sheet itself never
 * wraps the full screen in one Pressable (that would swallow touches meant
 * for the sheet's own content).
 */
export function CountryPickerModal({ visible, current, onClose, onSelect }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.dismissZone} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Country / Region</Text>
          <Text style={styles.sub}>Switch anytime — useful when you're travelling.</Text>

          {COUNTRIES.map((c) => {
            const active = c.code === current;
            const locale = LOCALES[c.code];
            return (
              <Pressable
                key={c.code}
                style={[styles.row, active && styles.rowActive]}
                onPress={() => onSelect(c.code)}
              >
                <Text style={styles.flag}>{c.flag}</Text>
                <View style={styles.meta}>
                  <Text style={styles.name}>{c.name}</Text>
                  <Text style={styles.cur}>
                    {locale.currencySymbol} {locale.currencyCode} · {locale.taxLabel}
                  </Text>
                </View>
                {active ? (
                  <View style={styles.check}>
                    <Text style={styles.checkMark}>✓</Text>
                  </View>
                ) : (
                  <View style={styles.radio} />
                )}
              </Pressable>
            );
          })}

          <Text style={styles.note}>
            Changing this updates currency and tax labels for new invoices going forward. Invoices you already
            have keep the currency they were created in.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(11,37,69,0.45)", justifyContent: "flex-end" },
  dismissZone: { flex: 1 },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
  },
  handle: { width: 36, height: 4, borderRadius: 99, backgroundColor: colors.line, alignSelf: "center", marginBottom: 14 },
  title: { fontFamily: fonts.displayBold, fontSize: 16.5, color: colors.navy },
  sub: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.muted2, marginTop: 2, marginBottom: 14 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 12,
    borderRadius: 14,
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  rowActive: { backgroundColor: colors.tealTint, borderColor: colors.teal },
  flag: { fontSize: 22 },
  meta: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.navy },
  cur: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.muted2, marginTop: 1 },
  check: { width: 22, height: 22, borderRadius: 999, backgroundColor: colors.teal, alignItems: "center", justifyContent: "center" },
  checkMark: { color: "#fff", fontSize: 12, fontWeight: "700" },
  radio: { width: 22, height: 22, borderRadius: 999, borderWidth: 1.5, borderColor: colors.line },
  note: {
    marginTop: 10,
    fontFamily: fonts.bodyRegular,
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.muted2,
    backgroundColor: colors.appBg,
    borderRadius: 10,
    padding: 11,
  },
});
