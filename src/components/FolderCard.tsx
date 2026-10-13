import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { Folder, formatINR, maskDigits } from "@/data/folders";
import { FolderIcon } from "@/components/FolderIcon";
import { useAmountVisibility } from "@/components/AmountVisibility";

function subText(folder: Folder, hidden: boolean): string {
  if (!hidden) return `${folder.count} · ${formatINR(folder.amount)}`;
  return `${maskDigits(String(folder.count))} · ${maskDigits(formatINR(folder.amount))}`;
}

export interface FolderSpotlight {
  badgeLabel: "SPOTLIGHT" | "FESTIVAL";
}

/** Soft pulsing ring behind the folder icon, looping while a spotlight is active — same "glance-able, not flashing" treatment as the Peak-Hours Spotlight demo. */
function PulseRing({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    const loop = Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 2200, easing: Easing.out(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
  const opacity = anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.55, 0.25, 0] });
  return (
    <Animated.View pointerEvents="none" style={[styles.pulseRing, { borderColor: color, opacity, transform: [{ scale }] }]} />
  );
}

interface CardProps {
  folder: Folder;
  onPress: () => void;
  spotlight?: FolderSpotlight | null;
}

export function FolderCard({ folder, onPress, spotlight }: CardProps) {
  const { hidden } = useAmountVisibility();
  const festival = spotlight?.badgeLabel === "FESTIVAL";
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.icon}>
        <FolderIcon name={folder.name} size={17} color={colors.gold} />
        {spotlight && <PulseRing color={festival ? colors.gold : colors.teal} />}
        {spotlight && (
          <View style={[styles.spotlightBadge, festival && styles.spotlightBadgeFestival]}>
            <Text style={styles.spotlightBadgeText}>{spotlight.badgeLabel}</Text>
          </View>
        )}
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
        <FolderIcon name={folder.name} size={18} color={colors.gold} />
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
  pulseRing: { position: "absolute", top: -3, left: -3, right: -3, bottom: -3, borderRadius: 13, borderWidth: 2 },
  spotlightBadge: {
    position: "absolute",
    top: -7,
    right: -7,
    backgroundColor: colors.teal,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 999,
  },
  spotlightBadgeFestival: { backgroundColor: colors.gold },
  spotlightBadgeText: { fontFamily: fonts.bodyBold, fontSize: 6.5, color: "#fff", letterSpacing: 0.3 },
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
