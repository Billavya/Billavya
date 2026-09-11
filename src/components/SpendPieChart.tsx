import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { formatINR } from "@/data/folders";
import type { Bucket, CombinedInvoice } from "@/hooks/useCombinedInvoices";

type Mode = "category" | "location" | "month";

interface Props {
  /** Baseline-accurate category totals (folder counts/amounts, live invoices already merged in). */
  byFolder: Record<string, Bucket>;
  /** Every invoice location/month drill-downs are computed from. */
  invoices: CombinedInvoice[];
}

const MODES: { key: Mode; label: string; drillable: boolean }[] = [
  { key: "category", label: "Category", drillable: false },
  { key: "location", label: "Location", drillable: true },
  { key: "month", label: "Month", drillable: true },
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

function groupBy(invoices: CombinedInvoice[], key: "location" | "month" | "folder"): Record<string, Bucket> {
  const out: Record<string, Bucket> = {};
  for (const inv of invoices) {
    const b = (out[inv[key]] ||= { count: 0, amount: 0 });
    b.count += 1;
    b.amount += inv.amount;
  }
  return out;
}

export function SpendPieChart({ byFolder, invoices }: Props) {
  const [mode, setMode] = useState<Mode>("category");
  const [drill, setDrill] = useState<string | null>(null);

  const { byLocation, byMonth } = useMemo(
    () => ({ byLocation: groupBy(invoices, "location"), byMonth: groupBy(invoices, "month") }),
    [invoices]
  );

  const modeInfo = MODES.find((m) => m.key === mode)!;
  const baseSource = mode === "category" ? byFolder : mode === "location" ? byLocation : byMonth;

  // Drilling into a city or month re-groups just that slice's invoices by category.
  const drillSource = useMemo(() => {
    if (!drill || !modeInfo.drillable) return null;
    const key = mode === "location" ? "location" : "month";
    return groupBy(
      invoices.filter((inv) => inv[key] === drill),
      "folder"
    );
  }, [drill, mode, modeInfo.drillable, invoices]);

  const source = drillSource ?? baseSource;

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

  function selectMode(key: Mode) {
    setMode(key);
    setDrill(null);
  }

  function onLegendPress(label: string) {
    if (!modeInfo.drillable) return;
    setDrill((cur) => (cur === label ? null : label));
  }

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
                onPress={() => selectMode(m.key)}
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

      {drill && (
        <Pressable style={styles.breadcrumb} onPress={() => setDrill(null)} accessibilityRole="button">
          <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
            <Path d="M15 5 8 12l7 7" stroke={colors.tealDark} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.breadcrumbText}>
            {drill} · category split — tap to go back to {modeInfo.label.toLowerCase()}s
          </Text>
        </Pressable>
      )}

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
              <Text style={styles.centerLabel} numberOfLines={1}>
                {(drill ?? modeInfo.label).toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.legend}>
            {slices.map((s) => {
              const clickable = !drill && modeInfo.drillable;
              const row = (
                <>
                  <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                  <Text style={styles.legendLabel} numberOfLines={1}>
                    {s.label}
                  </Text>
                  <Text style={styles.legendPct}>{Math.round(s.pct * 100)}%</Text>
                  {clickable && (
                    <Svg width={9} height={9} viewBox="0 0 24 24" fill="none">
                      <Path d="m9 5 7 7-7 7" stroke={colors.muted2} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  )}
                </>
              );
              return clickable ? (
                <Pressable
                  key={s.label}
                  style={({ pressed }) => [styles.legendItem, pressed && styles.legendItemPressed]}
                  onPress={() => onLegendPress(s.label)}
                  accessibilityRole="button"
                  accessibilityLabel={`See category split for ${s.label}`}
                >
                  {row}
                </Pressable>
              ) : (
                <View key={s.label} style={styles.legendItem}>
                  {row}
                </View>
              );
            })}
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
    color: colors.navy2,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
  tabActive: { backgroundColor: colors.navy, color: "#fff" },
  breadcrumb: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: colors.tealTint,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginBottom: 10,
  },
  breadcrumbText: { fontFamily: fonts.bodySemibold, fontSize: 10, color: colors.tealDark },
  empty: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.navy2, textAlign: "center", paddingVertical: 18 },
  body: { flexDirection: "row", alignItems: "center", gap: 14 },
  donutWrap: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
  donutCenter: { position: "absolute", alignItems: "center", justifyContent: "center", width: SIZE - STROKE * 2, paddingHorizontal: 4 },
  centerValue: { fontFamily: fonts.displayBold, fontSize: 13, color: colors.navy },
  centerLabel: { fontFamily: fonts.bodySemibold, fontSize: 7.5, letterSpacing: 0.8, color: colors.navy2, marginTop: 1 },
  legend: { flex: 1, minWidth: 0, gap: 3 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, borderRadius: 8 },
  legendItemPressed: { backgroundColor: colors.appBg },
  legendDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  legendLabel: { flex: 1, minWidth: 0, fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.navy2 },
  legendPct: { fontFamily: fonts.bodyBold, fontSize: 10.5, color: colors.navy2, fontVariant: ["tabular-nums"] },
});
