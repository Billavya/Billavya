import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

interface Props {
  visible: boolean;
  label: string;
  initialDate: Date;
  /** Optional bounds — e.g. "To" can't go before the current "From" date, and vice versa. */
  minDate?: Date | null;
  maxDate?: Date | null;
  onClose: () => void;
  onSelect: (date: Date) => void;
}

/**
 * A small self-contained month calendar. No native date-picker dependency —
 * that would be a native module, which can't ship over OTA — so this is
 * plain JS/RN, styled to match the rest of the app.
 *
 * Follows the Modal structure established for every other sheet in this app
 * (see InvoiceDetailModal/OfferDetailModal): the overlay is a plain View,
 * and a SEPARATE sibling Pressable handles tap-outside-to-dismiss — a full
 * screen Pressable wrapping the sheet blocks touches from ever reaching it.
 */
export function DatePickerModal({ visible, label, initialDate, minDate, maxDate, onClose, onSelect }: Props) {
  // See InvoiceDetailModal — the Close button sits right against the
  // sheet's own bottom edge, so it needs the real safe-area inset added in.
  const insets = useSafeAreaInsets();
  const [cursor, setCursor] = useState(() => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));

  useEffect(() => {
    if (visible) setCursor(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  }, [visible, initialDate]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function isSameDay(d: number, ref: Date) {
    return ref.getFullYear() === year && ref.getMonth() === month && ref.getDate() === d;
  }
  function isDisabled(d: number) {
    const candidate = new Date(year, month, d, 12, 0, 0, 0);
    if (minDate && candidate < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) return true;
    if (maxDate && candidate > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())) return true;
    return false;
  }
  // Stop navigation right at the bound's month, instead of letting someone
  // page into a month where every single day is greyed out.
  const atMinMonth = !!minDate && year === minDate.getFullYear() && month === minDate.getMonth();
  const atMaxMonth = !!maxDate && year === maxDate.getFullYear() && month === maxDate.getMonth();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.dismissZone} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: 28 + insets.bottom }]}>
          <Text style={styles.label}>{label}</Text>

          <View style={styles.monthRow}>
            <Pressable
              style={[styles.navBtn, atMinMonth && styles.navBtnDisabled]}
              disabled={atMinMonth}
              onPress={() => setCursor(new Date(year, month - 1, 1))}
              accessibilityLabel="Previous month"
              hitSlop={8}
            >
              <Text style={[styles.navBtnText, atMinMonth && styles.navBtnTextDisabled]}>‹</Text>
            </Pressable>
            <Text style={styles.monthLabel}>
              {MONTH_NAMES[month]} {year}
            </Text>
            <Pressable
              style={[styles.navBtn, atMaxMonth && styles.navBtnDisabled]}
              disabled={atMaxMonth}
              onPress={() => setCursor(new Date(year, month + 1, 1))}
              accessibilityLabel="Next month"
              hitSlop={8}
            >
              <Text style={[styles.navBtnText, atMaxMonth && styles.navBtnTextDisabled]}>›</Text>
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, i) => (
              <Text key={i} style={styles.weekday}>
                {w}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((d, i) => {
              if (d == null) return <View key={i} style={styles.cell} />;
              const selected = isSameDay(d, initialDate);
              const isToday = isSameDay(d, today);
              const disabled = isDisabled(d);
              return (
                <View key={i} style={styles.cell}>
                  <Pressable
                    disabled={disabled}
                    style={[styles.day, selected && styles.daySelected, isToday && !selected && styles.dayToday]}
                    onPress={() => onSelect(new Date(year, month, d))}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        selected && styles.dayTextSelected,
                        disabled && styles.dayTextDisabled,
                      ]}
                    >
                      {d}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </Pressable>
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
    paddingBottom: 28,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.muted,
    textAlign: "center",
    marginBottom: 10,
  },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.appBg,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  navBtnText: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.navy, marginTop: -2 },
  navBtnDisabled: { opacity: 0.35 },
  navBtnTextDisabled: { color: colors.muted2 },
  monthLabel: { fontFamily: fonts.displayBold, fontSize: 16.5, color: colors.navy },
  weekRow: { flexDirection: "row" },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.muted2,
    marginBottom: 6,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  day: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  daySelected: { backgroundColor: colors.navy },
  dayToday: { borderWidth: 1.5, borderColor: colors.teal },
  dayText: { fontFamily: fonts.bodySemibold, fontSize: 13.5, color: colors.navy2 },
  dayTextSelected: { color: "#fff" },
  dayTextDisabled: { color: colors.muted2, opacity: 0.4 },
  closeBtn: {
    marginTop: 16,
    height: 46,
    borderRadius: 13,
    backgroundColor: colors.appBg,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.navy },
});
