import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { Folder, formatINR, maskDigits } from "@/data/folders";
import { FolderIcon } from "@/components/FolderIcon";
import { useAmountVisibility } from "@/components/AmountVisibility";

function subText(folder: Folder, hidden: boolean): string {
  if (!hidden) return `${folder.count} · ${formatINR(folder.amount)}`;
  return `${maskDigits(String(folder.count))} · ${maskDigits(formatINR(folder.amount))}`;
}

interface CardProps {
  folder: Folder;
  onPress: () => void;
}

export function FolderCard({ folder, onPress }: CardProps) {
  const { hidden } = useAmountVisibility();
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.icon}>
        <FolderIcon name={folder.name} size={17} color={colors.teal} />
      </View>
      <View style={styles.meta}>
        <Text style={styles.name} numberOfLines={1}>
          {folder.name}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {subText(folder, hidden)}
        </Text>
      </View>
    </Pressable>
  );
}

interface RowProps {
  folder: Folder;
  onPress: () => void;
}

export function FolderRow({ folder, onPress }: RowProps) {
  const { hidden } = useAmountVisibility();
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onPress}>
      <View style={[styles.icon, styles.rowIcon]}>
        <FolderIcon name={folder.name} size={18} color={colors.teal} />
      </View>
      <View style={styles.meta}>
        <Text style={[styles.name, styles.rowName]}>{folder.name}</Text>
        <Text style={[styles.sub, styles.rowSub]}>{subText(folder, hidden)}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  row: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  pressed: { borderColor: colors.teal },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  rowIcon: { width: 36, height: 36 },
  meta: { flex: 1, minWidth: 0 },
  name: {
    fontFamily: fonts.bodyBold,
    fontSize: 14.5,
    color: colors.navy2,
  },
  rowName: { fontSize: 15.5 },
  sub: {
    marginTop: 2,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.muted2,
  },
  rowSub: { fontSize: 13 },
  chevron: {
    fontFamily: fonts.bodyBold,
    fontSize: 20,
    color: colors.muted2,
  },
});
