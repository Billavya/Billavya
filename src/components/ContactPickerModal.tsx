import React, { useMemo, useState } from "react";
import { Dimensions, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { CONTACTS, Contact } from "@/data/contacts";

// The sheet itself is left auto-height; only this list gets a hard numeric
// cap, so there's a single unambiguous height constraint in the tree rather
// than a maxHeight on the sheet fighting a flexShrink on its child.
const MAX_LIST_HEIGHT = Math.round(Dimensions.get("window").height * 0.55);

interface Props {
  visible: boolean;
  /** "single" confirms the instant a contact is tapped; "multi" needs exactly `limit` picks + Confirm. */
  mode: "single" | "multi";
  limit?: number;
  title: string;
  onConfirm: (selected: Contact[]) => void;
  onClose: () => void;
}

export function ContactPickerModal({ visible, mode, limit = 1, title, onConfirm, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CONTACTS;
    return CONTACTS.filter((c) => c.name.toLowerCase().includes(q));
  }, [query]);

  function reset() {
    setQuery("");
    setSelectedIds([]);
  }

  function close() {
    reset();
    onClose();
  }

  function toggle(c: Contact) {
    if (mode === "single") {
      reset();
      onConfirm([c]);
      return;
    }
    setSelectedIds((prev) => {
      if (prev.includes(c.id)) return prev.filter((id) => id !== c.id);
      if (prev.length >= limit) return prev;
      return [...prev, c.id];
    });
  }

  function confirmMulti() {
    const chosen = CONTACTS.filter((c) => selectedIds.includes(c.id));
    reset();
    onConfirm(chosen);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      {/* See InvoiceDetailModal for the full story: a full-screen overlay
          Pressable sitting on top of the sheet — not just the sheet's own
          wrapper — was what actually intercepted every scroll gesture.
          Tap-to-dismiss now lives on its own sibling Pressable covering only
          the space above the sheet, so it never overlaps the FlatList. */}
      <View style={styles.overlay}>
        <Pressable style={styles.dismissZone} onPress={close} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headRow}>
            <Text style={styles.title}>{title}</Text>
            {mode === "multi" && (
              <Text style={styles.counter}>
                {selectedIds.length}/{limit} selected
              </Text>
            )}
          </View>

          <View style={styles.searchField}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Circle cx="11" cy="11" r="7" stroke={colors.muted2} strokeWidth={2} />
              <Path d="m20 20-3.5-3.5" stroke={colors.muted2} strokeWidth={2} strokeLinecap="round" />
            </Svg>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search contacts…"
              placeholderTextColor={colors.muted2}
            />
          </View>

          <FlatList
            data={results}
            keyExtractor={(c) => c.id}
            style={styles.list}
            contentContainerStyle={{ gap: 6, paddingBottom: 8 }}
            showsVerticalScrollIndicator
            persistentScrollbar
            renderItem={({ item }) => {
              const on = selectedIds.includes(item.id);
              return (
                <Pressable style={[styles.row, on && styles.rowOn]} onPress={() => toggle(item)}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.name[0]}</Text>
                  </View>
                  <View style={styles.rowMeta}>
                    <Text style={styles.rowName}>{item.name}</Text>
                    <Text style={styles.rowPhone}>{item.phone}</Text>
                  </View>
                  {mode === "multi" && <View style={[styles.checkbox, on && styles.checkboxOn]}>{on && <Text style={styles.checkMark}>✓</Text>}</View>}
                </Pressable>
              );
            }}
            ListEmptyComponent={<Text style={styles.empty}>No contacts match "{query}".</Text>}
          />

          {mode === "multi" && (
            <Pressable
              style={[styles.confirmBtn, selectedIds.length !== limit && styles.confirmBtnDisabled]}
              disabled={selectedIds.length !== limit}
              onPress={confirmMulti}
            >
              <Text style={styles.confirmBtnText}>
                {selectedIds.length === limit ? "Confirm" : `Select ${limit - selectedIds.length} more`}
              </Text>
            </Pressable>
          )}

          <Text style={styles.hint}>Sample contacts — this preview can't read your phone's real address book.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(11,37,69,0.45)" },
  dismissZone: { flex: 1 },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 28 },
  handle: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 14 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontFamily: fonts.displayBold, fontSize: 17.5, color: colors.navy },
  counter: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.tealDark },
  searchField: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 40,
    paddingHorizontal: 12,
    backgroundColor: colors.appBg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
  },
  searchInput: { flex: 1, fontFamily: fonts.bodyRegular, fontSize: 14.5, color: colors.navy2, padding: 0 },
  // Same fix as InvoiceDetailModal's ScrollView: without flexShrink, this
  // list ignores the sheet's maxHeight and just grows with the contact
  // count instead of clipping and scrolling within the available space.
  list: { marginTop: 10, maxHeight: MAX_LIST_HEIGHT },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  rowOn: { borderColor: colors.teal, backgroundColor: colors.tealTint },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.displayBold, fontSize: 16.5, color: colors.teal },
  rowMeta: { flex: 1, minWidth: 0 },
  rowName: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.navy2 },
  rowPhone: { marginTop: 1, fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.muted2 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  checkMark: { color: "#fff", fontSize: 14, fontWeight: "700" },
  empty: { textAlign: "center", padding: 20, fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.muted2 },
  confirmBtn: { marginTop: 6, height: 46, borderRadius: 13, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: "#fff" },
  hint: { marginTop: 10, fontFamily: fonts.bodyRegular, fontSize: 11, color: colors.muted2, textAlign: "center" },
});
