import React, { useEffect, useState } from "react";
import { Dimensions, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { createOtherFolder, MAX_OTHER_FOLDERS, OtherFolder, subscribeOtherFolders } from "@/services/otherFolders";
import { useToast } from "@/components/Toast";

// Capped well short of full height so there's always room left for the
// keyboard (shifted into view by KeyboardAvoidingView below) without the
// sheet's own content ever needing to shrink — it scrolls instead.
const MAX_SCROLL_HEIGHT = Math.round(Dimensions.get("window").height * 0.6);

interface Props {
  visible: boolean;
  avyayaId: string | null;
  /** The invoice's current folder, if any — drives the checkmark and whether "Remove" shows. */
  currentFolderId?: string | null;
  onClose: () => void;
  /** Pass the chosen folder, or null to file this invoice out of Other entirely. */
  onSelect: (folder: OtherFolder | null) => void;
}

/**
 * Same Modal structure as every other sheet in this app (see
 * DatePickerModal/CountryPickerModal): a plain overlay View, a separate
 * sibling Pressable for tap-outside-to-dismiss, and the sheet itself never
 * wraps the full screen in one Pressable.
 */
export function OtherFolderPickerModal({ visible, avyayaId, currentFolderId, onClose, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const [folders, setFolders] = useState<OtherFolder[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!avyayaId) return;
    return subscribeOtherFolders(avyayaId, setFolders);
  }, [avyayaId]);

  useEffect(() => {
    if (!visible) {
      setCreating(false);
      setNewName("");
    }
  }, [visible]);

  const atLimit = folders.length >= MAX_OTHER_FOLDERS;

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed || !avyayaId || busy) return;
    setBusy(true);
    try {
      const folder = await createOtherFolder(avyayaId, trimmed);
      setCreating(false);
      setNewName("");
      onSelect(folder);
    } catch (e: any) {
      showToast(e?.message === "max_folders_reached" ? `You can only have ${MAX_OTHER_FOLDERS} folders` : "Couldn't create folder — check your connection");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.dismissZone} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>File under "Other"</Text>
          <Text style={styles.sub}>Choose one of your folders, or create a new one — up to {MAX_OTHER_FOLDERS} in total.</Text>

          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={{ paddingBottom: 12 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
          {folders.map((folder) => {
            const active = folder.id === currentFolderId;
            return (
              <Pressable key={folder.id} style={[styles.row, active && styles.rowActive]} onPress={() => onSelect(folder)}>
                <View style={styles.rowIcon}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M11 4H5a1 1 0 0 0-1 1v6l9 9 7-7-9-9Z" stroke={colors.gold} strokeWidth={1.8} strokeLinejoin="round" />
                  </Svg>
                </View>
                <Text style={styles.rowLabel}>{folder.name}</Text>
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

          {currentFolderId != null && (
            <Pressable style={styles.removeRow} onPress={() => onSelect(null)}>
              <Text style={styles.removeRowText}>Remove from Other</Text>
            </Pressable>
          )}

          {creating ? (
            <View style={styles.createBox}>
              <TextInput
                style={styles.createInput}
                placeholder="e.g. Electronics"
                value={newName}
                onChangeText={setNewName}
                autoFocus
                maxLength={30}
                onSubmitEditing={handleCreate}
              />
              <View style={styles.createActions}>
                <Pressable style={styles.createCancel} onPress={() => { setCreating(false); setNewName(""); }}>
                  <Text style={styles.createCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.createConfirm, (!newName.trim() || busy) && styles.createConfirmDisabled]}
                  disabled={!newName.trim() || busy}
                  onPress={handleCreate}
                >
                  <Text style={styles.createConfirmText}>{busy ? "Creating…" : "Create"}</Text>
                </Pressable>
              </View>
            </View>
          ) : atLimit ? (
            <Text style={styles.limitNote}>You've reached the {MAX_OTHER_FOLDERS}-folder limit — remove one to add another.</Text>
          ) : (
            <Pressable style={styles.addRow} onPress={() => setCreating(true)}>
              <Text style={styles.addRowPlus}>+</Text>
              <Text style={styles.addRowText}>Create new folder</Text>
            </Pressable>
          )}
          </ScrollView>

          <Pressable style={[styles.closeBtn, { marginBottom: insets.bottom }]} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(11,37,69,0.45)", justifyContent: "flex-end" },
  dismissZone: { flex: 1 },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20 },
  scrollBody: { maxHeight: MAX_SCROLL_HEIGHT },
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
    backgroundColor: colors.appBg,
  },
  rowActive: { backgroundColor: colors.tealTint, borderColor: colors.teal },
  rowIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 14, color: colors.navy },
  check: { width: 22, height: 22, borderRadius: 999, backgroundColor: colors.teal, alignItems: "center", justifyContent: "center" },
  checkMark: { color: "#fff", fontSize: 12, fontWeight: "700" },
  radio: { width: 22, height: 22, borderRadius: 999, borderWidth: 1.5, borderColor: colors.line },

  removeRow: { paddingVertical: 11, alignItems: "center", marginTop: 2, marginBottom: 6 },
  removeRowText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.dangerBright },

  addRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.teal,
    borderStyle: "dashed",
    marginTop: 4,
  },
  addRowPlus: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.tealDark },
  addRowText: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.tealDark },
  limitNote: { marginTop: 4, fontSize: 11.5, lineHeight: 16, color: colors.muted2, textAlign: "center", fontFamily: fonts.bodyMedium },

  createBox: { marginTop: 4, backgroundColor: colors.appBg, borderRadius: 14, padding: 12 },
  createInput: {
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
    color: colors.navy2,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    padding: 11,
  },
  createActions: { flexDirection: "row", gap: 9, marginTop: 10 },
  createCancel: { flex: 1, height: 42, borderRadius: 11, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  createCancelText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.navy2 },
  createConfirm: { flex: 1, height: 42, borderRadius: 11, backgroundColor: colors.teal, alignItems: "center", justifyContent: "center" },
  createConfirmDisabled: { opacity: 0.45 },
  createConfirmText: { fontFamily: fonts.bodyBold, fontSize: 13, color: "#06241F" },

  closeBtn: { height: 46, borderRadius: 12, backgroundColor: colors.appBg, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", marginTop: 16 },
  closeBtnText: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.navy2 },
});
