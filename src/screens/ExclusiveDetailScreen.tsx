import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { formatINR } from "@/data/folders";
import { InvoiceDetailModal } from "@/components/InvoiceDetailModal";
import { LiveInvoice } from "@/services/invoices";
import { useCombinedInvoices, CombinedInvoice } from "@/hooks/useCombinedInvoices";
import { EXCLUSIVE_KINDS, ExclusiveKind } from "@/data/exclusiveKinds";
import { useProfileId } from "@/utils/profileId";
import { createOtherFolder, MAX_OTHER_FOLDERS, OtherFolder, subscribeOtherFolders } from "@/services/otherFolders";
import { useToast } from "@/components/Toast";

/** The "Others" kind drills into one of the customer's own subfolders
 *  before showing invoices — "unfiled" is the catch-all bucket for
 *  invoices tagged Other before subfolders existed, or filed without
 *  picking one. Every other kind has no such concept and goes straight
 *  to its flat invoice list. */
type OtherSelection = OtherFolder | "unfiled";

const EMPTY_COPY: Record<ExclusiveKind, string> = {
  gift: "Nothing here yet. Open any invoice and tap the Gift tag to collect it here.",
  warranty: "Nothing here yet. Open any invoice and tap the Warranty tag to collect it here.",
  split: "Nothing here yet. Split an invoice with friends from its Split button to collect it here.",
  transferred: "Nothing here yet. Invoices you hand off from the Transfer button will show up here.",
  received: "Nothing here yet. This fills up when another Avyaya user transfers an invoice to you — account-to-account transfers aren't wired up in this preview, only handing one away is.",
  other: "Nothing here yet. Open any invoice and tap the Other tag to collect it here.",
};

export function ExclusiveDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const kind: ExclusiveKind = route.params?.kind;
  const info = EXCLUSIVE_KINDS.find((k) => k.kind === kind)!;
  const { showToast } = useToast();

  const { invoices, markSeen } = useCombinedInvoices();
  const { id: avyayaId } = useProfileId();
  const [open, setOpen] = useState<LiveInvoice | null>(null);

  // "Others" drills into one of the customer's own subfolders first — null
  // means "show the folder list", not "show every Other invoice flat".
  const [otherFolders, setOtherFolders] = useState<OtherFolder[]>([]);
  const [otherSelection, setOtherSelection] = useState<OtherSelection | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [createBusy, setCreateBusy] = useState(false);

  useEffect(() => {
    if (kind !== "other" || !avyayaId) return;
    return subscribeOtherFolders(avyayaId, setOtherFolders);
  }, [kind, avyayaId]);

  const otherCounts = useMemo(() => {
    const counts: Record<string, number> = { unfiled: 0 };
    if (kind !== "other") return counts;
    for (const inv of invoices) {
      if (!inv.otherLabel) continue;
      const key = inv.otherFolderId || "unfiled";
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [invoices, kind]);

  const filtered = useMemo(() => {
    if (kind === "received") return [];
    return invoices.filter((inv) => {
      if (kind === "gift") return !!inv.giftLabel;
      if (kind === "warranty") return !!inv.warranty;
      if (kind === "split") return inv.splitYourShare != null;
      if (kind === "transferred") return !!inv.transferredTo;
      if (kind === "other") {
        if (!inv.otherLabel) return false;
        if (otherSelection === "unfiled") return !inv.otherFolderId;
        if (otherSelection) return inv.otherFolderId === otherSelection.id;
        return false; // folder-list view — this list isn't rendered at all
      }
      return false;
    });
  }, [invoices, kind, otherSelection]);

  const showingFolderList = kind === "other" && otherSelection === null;
  const totalOtherCount = Object.values(otherCounts).reduce((a, b) => a + b, 0);

  async function handleCreateFolder() {
    const trimmed = newFolderName.trim();
    if (!trimmed || !avyayaId || createBusy) return;
    setCreateBusy(true);
    try {
      await createOtherFolder(avyayaId, trimmed);
      setCreatingFolder(false);
      setNewFolderName("");
    } catch (e: any) {
      showToast(e?.message === "max_folders_reached" ? `You can only have ${MAX_OTHER_FOLDERS} folders` : "Couldn't create folder — check your connection");
    } finally {
      setCreateBusy(false);
    }
  }

  function handleBack() {
    if (kind === "other" && otherSelection !== null) {
      setOtherSelection(null);
      return;
    }
    navigation.goBack();
  }

  const headerTitle = showingFolderList || kind !== "other" ? info.name : otherSelection === "unfiled" ? "Unfiled" : (otherSelection as OtherFolder).name;
  const headerCount = showingFolderList ? totalOtherCount : filtered.length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={handleBack} accessibilityLabel="Back">
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M15 5 8 12l7 7" stroke={colors.navy} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <View style={[styles.icon, { backgroundColor: info.bg, borderColor: info.border }]}>{info.icon(colors.navy)}</View>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{headerTitle}</Text>
          <Text style={styles.subtitle}>
            {headerCount} {headerCount === 1 ? "invoice" : "invoices"}
          </Text>
        </View>
      </View>

      {showingFolderList ? (
        <FlatList
          data={otherFolders}
          keyExtractor={(f) => f.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListHeaderComponent={
            otherCounts.unfiled > 0 ? (
              <Pressable style={styles.folderRow} onPress={() => setOtherSelection("unfiled")}>
                <View style={styles.folderIcon}>
                  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                    <Path d="M11 4H5a1 1 0 0 0-1 1v6l9 9 7-7-9-9Z" stroke={colors.gold} strokeWidth={1.8} strokeLinejoin="round" />
                  </Svg>
                </View>
                <Text style={styles.folderName}>Unfiled</Text>
                <Text style={styles.folderCount}>{otherCounts.unfiled}</Text>
                <Text style={styles.folderChevron}>›</Text>
              </Pressable>
            ) : null
          }
          ListFooterComponent={
            creatingFolder ? (
              <View style={styles.createBox}>
                <TextInput
                  style={styles.createInput}
                  placeholder="e.g. Electronics"
                  value={newFolderName}
                  onChangeText={setNewFolderName}
                  autoFocus
                  maxLength={30}
                  onSubmitEditing={handleCreateFolder}
                />
                <View style={styles.createActions}>
                  <Pressable style={styles.createCancel} onPress={() => { setCreatingFolder(false); setNewFolderName(""); }}>
                    <Text style={styles.createCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.createConfirm, (!newFolderName.trim() || createBusy) && styles.createConfirmDisabled]}
                    disabled={!newFolderName.trim() || createBusy}
                    onPress={handleCreateFolder}
                  >
                    <Text style={styles.createConfirmText}>{createBusy ? "Creating…" : "Create"}</Text>
                  </Pressable>
                </View>
              </View>
            ) : otherFolders.length < MAX_OTHER_FOLDERS ? (
              <Pressable style={styles.addFolderRow} onPress={() => setCreatingFolder(true)}>
                <Text style={styles.addFolderPlus}>+</Text>
                <Text style={styles.addFolderText}>Create new folder</Text>
              </Pressable>
            ) : (
              <Text style={styles.limitNote}>You've reached the {MAX_OTHER_FOLDERS}-folder limit.</Text>
            )
          }
          ListEmptyComponent={otherCounts.unfiled === 0 ? <Text style={styles.empty}>{EMPTY_COPY.other}</Text> : null}
          renderItem={({ item }: { item: OtherFolder }) => (
            <Pressable style={styles.folderRow} onPress={() => setOtherSelection(item)}>
              <View style={styles.folderIcon}>
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                  <Path d="M11 4H5a1 1 0 0 0-1 1v6l9 9 7-7-9-9Z" stroke={colors.gold} strokeWidth={1.8} strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={styles.folderName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.folderCount}>{otherCounts[item.id] || 0}</Text>
              <Text style={styles.folderChevron}>›</Text>
            </Pressable>
          )}
        />
      ) : (
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {kind === "other" && otherSelection !== null
              ? `Nothing filed here yet. Open an invoice, tap Other, and choose "${headerTitle}" to collect it here.`
              : EMPTY_COPY[kind]}
          </Text>
        }
        renderItem={({ item }: { item: CombinedInvoice }) => {
          const hasCopy = item.live && !!item.detail;
          const transferred = kind === "transferred" && !!item.transferredTo;
          const split = kind === "split" && item.splitYourShare != null;
          function handlePress() {
            markSeen(item.key);
            if (item.detail) setOpen(item.detail);
          }
          const row = (
            <View style={[styles.row, { borderColor: info.border, backgroundColor: info.bg }]}>
              <View style={styles.meta}>
                <Text style={styles.store} numberOfLines={1}>
                  {item.store}
                </Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {item.folder} · {item.date}
                  {transferred ? ` · to ${item.transferredTo}` : ""}
                  {split ? ` · split among ${item.splitCount}` : ""}
                </Text>
              </View>
              {/* item.amount already IS your share for a split invoice — see
                  effectiveAmount() in useCombinedInvoices.ts — so no special
                  case needed here the way "transferred" needs one. */}
              <Text style={[styles.amount, transferred && styles.amountNegative]}>
                {transferred ? "−" : ""}
                {formatINR(item.amount)}
              </Text>
            </View>
          );
          return hasCopy ? <Pressable onPress={handlePress}>{row}</Pressable> : row;
        }}
      />
      )}

      <InvoiceDetailModal invoice={open} onClose={() => setOpen(null)} />
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
  icon: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  titleWrap: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.navy },
  subtitle: { marginTop: 2, fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.navy2 },
  listContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 11, borderWidth: 1, borderRadius: 14, padding: 12 },
  meta: { flex: 1, minWidth: 0 },
  store: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.navy2 },
  sub: { marginTop: 2, fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted2 },
  amount: { fontFamily: fonts.displayBold, fontSize: 13, color: colors.navy },
  amountNegative: { color: colors.dangerDark },
  empty: { textAlign: "center", marginTop: 24, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 20, color: colors.muted2 },

  folderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 13,
  },
  folderIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" },
  folderName: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.navy2 },
  folderCount: { fontFamily: fonts.bodySemibold, fontSize: 12.5, color: colors.muted2 },
  folderChevron: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.muted2 },

  addFolderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.teal,
    borderStyle: "dashed",
    marginTop: 8,
  },
  addFolderPlus: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.tealDark },
  addFolderText: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.tealDark },
  limitNote: { marginTop: 10, fontSize: 11.5, lineHeight: 16, color: colors.muted2, textAlign: "center", fontFamily: fonts.bodyMedium },

  createBox: { marginTop: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 12 },
  createInput: {
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
    color: colors.navy2,
    backgroundColor: colors.appBg,
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
});
