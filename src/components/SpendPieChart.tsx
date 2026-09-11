import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { formatINR } from "@/data/folders";
import type { Bucket } from "@/hooks/useCombinedInvoices";

type Mode = "category" | "location" | "month";

interface Props {
  byFolder: Record<string, Bucket>;
  byLocation: Record<string, Bucket>;
  byMonth: Record<string, Bucket>;
}

const MODES: { key: Mode; label: string }[] = [
  { key: "category", label: "Category" },
  { key: "location", label: "Location" },
  { key: "month", label: "Month" },
];

const PALETTE = [
  "#00C2A8", // teal
  "#0B2545", // navy
  "#F59E0B", // amber
  "#2F6FED", // blue
  "#F43F5E", // rose
  "#8B5CF6", // violet
  "#22C55E", // green
  "#EAB308", // yellow
  "#06B6D4", // cyan
  "#F97316", // orange
  "#A855F7", // purple
  "#64748B", // slate
];

const SIZE = 118;
const STROKE = 20;
const R = (SIZE - STROKE) / 2;
const CX = SIZE / 2;
const CY = SIZE / 2;
const CIRC = 2 * Math.PI * R;

export function SpendPieChart({ byFolder, byLocation, byMonth }: Props) {
  const [mode, setMode] = useState<Mode>("category");

  const source = mode === "category" ? byFolder : mode === "location" ? byLocation : byMonth;

  const slices = useMemo(() => {
    const entries = Object.entries(source)
      .map(([label, b]) => ({ label, amount: b.amount, count: b.count }))
      .filter((e) => e.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    const total = entries.reduce((s, e) => s + e.amount, 0);
    let cursor = 0;
    return entries.map((e, i) => {
      const pct = total > 0 ? e.amount / total : 0;
      const len = pct * CIRC;
      const dasharray = `${len} ${CIRC - len}`;
      const dashoffset = -cursor;
      cursor += len;
      return { ...e, pct, dasharray, dashoffset, color: PALETTE[i % PALETTE.length] };
    });
  }, [source]);

  const total = slices.reduce((s, e) => s + e.amount, 0);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>Spend Breakdown</Text>
        <View style={styles.tabs}>
          {MODES.map((m) => {
            const active = m.key === mode;
            return (
              <Text
                key={m.key}
                onPress={() => setMode(m.key)}
                style={[styles.tab, active && styles.tabActive]}
                accessibilityRole="button"
                accessibilityLabel={`View spend by ${m.label}`}
              >
                {m.label}
              </Text>
            );
          })}
        </View>
      </View>

      {slices.length === 0 ? (
        <Text style={styles.empty}>No spend yet for this view.</Text>
      ) : (
        <View style={styles.body}>
          <View style={styles.donutWrap}>
            <Svg width={SIZE} height={SIZE}>
              <Circle cx={CX} cy={CY} r={R} stroke={colors.line} strokeWidth={STROKE} fill="none" />
              {slices.map((s) => (
                <Circle
                  key={s.label}
                  cx={CX}
                  cy={CY}
                  r={R}
                  stroke={s.color}
                  strokeWidth={STROKE}
                  fill="none"
                  strokeDasharray={s.dasharray}
                  strokeDashoffset={s.dashoffset}
                  strokeLinecap="butt"
                  transform={`rotate(-90 ${CX} ${CY})`}
                />
              ))}
            </Svg>
            <View style={styles.donutCenter} pointerEvents="none">
              <Text style={styles.centerValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatINR(total)}
              </Text>
              <Text style={styles.centerLabel}>{MODES.find((m) => m.key === mode)?.label.toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.legend}>
            {slices.map((s) => (
              <View key={s.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                <Text style={styles.legendLabel} numberOfLines={1}>
                  {s.label}
                </Text>
                <Text style={styles.legendPct}>{Math.round(s.pct * 100)}%</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 14,
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { fontFamily: fonts.displayBold, fontSize: 13.5, color: colors.navy },
  tabs: { flexDirection: "row", backgroundColor: colors.appBg, borderRadius: 999, padding: 2, gap: 2 },
  tab: {
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    color: colors.muted,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
  tabActive: { backgroundColor: colors.navy, color: "#fff" },
  empty: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.muted2, textAlign: "center", paddingVertical: 18 },
  body: { flexDirection: "row", alignItems: "center", gap: 14 },
  donutWrap: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
  donutCenter: { position: "absolute", alignItems: "center", justifyContent: "center", width: SIZE - STROKE * 2, paddingHorizontal: 4 },
  centerValue: { fontFamily: fonts.displayBold, fontSize: 13, color: colors.navy },
  centerLabel: { fontFamily: fonts.bodySemibold, fontSize: 7.5, letterSpacing: 0.8, color: colors.muted2, marginTop: 1 },
  legend: { flex: 1, minWidth: 0, gap: 7 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  legendLabel: { flex: 1, minWidth: 0, fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.navy2 },
  legendPct: { fontFamily: fonts.bodyBold, fontSize: 10.5, color: colors.muted, fontVariant: ["tabular-nums"] },
});
