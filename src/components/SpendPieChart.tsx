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

// Bumped modestly from 118/20 alongside the font increase, so the fixed
// circular label area actually has a bit more room — a geometric shape
// doesn't get to "scale like text," but it can still grow a little.
const SIZE = 126;
const STROKE = 21;
const R = (SIZE - STROKE) / 2;
const CX = SIZE / 2;
const CY = SIZE / 2;
const CIRC = 2 * Math.PI * R;

function groupBy(invoices: CombinedInvoice[], key: "location" | "month" | "folder"): Record<string, Bucket> {
  const out: Record<string, Bucket> = {};
  for (const inv of invoices) {
    if (inv.transferredTo) continue; // transferred invoices don't count toward anyone's totals
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
  // flexWrap added defensively: title + 3 tabs at the larger app-wide font
  // scale can get close to a narrow phone's width, especially with a long
  // drill-down label — wrapping to a second line beats silently overflowing.
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", rowGap: 6 },
  // Sized up from the original 13.5 but pulled back from the full app-wide
  // 16 — at 16 this crowded the tabs on narrower phones. flexShrink lets it
  // wrap onto its own line via `head`'s flexWrap rather than clip.
  title: { fontFamily: fonts.displayBold, fontSize: 14.5, color: colors.navy, flexShrink: 1 },
  tabs: { flexDirection: "row", backgroundColor: colors.appBg, borderRadius: 999, padding: 2, gap: 2 },
  tab: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
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
  breadcrumbText: { fontFamily: fonts.bodySemibold, fontSize: 11, color: colors.tealDark },
  empty: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.navy2, textAlign: "center", paddingVertical: 18 },
  body: { flexDirection: "row", alignItems: "center", gap: 14 },
  donutWrap: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
  donutCenter: { position: "absolute", alignItems: "center", justifyContent: "center", width: SIZE - STROKE * 2, paddingHorizontal: 4 },
  // The donut's center is a fixed-diameter circle, not a flexible text
  // column — at the full app-wide 15.5/9 these two crowded right up against
  // (and on some amounts, past) that circle's edge. Sized up from the
  // original 13/7.5 without going all the way to the general scale;
  // adjustsFontSizeToFit (on centerValue in the JSX) is the safety net for
  // any amount that's still too wide.
  centerValue: { fontFamily: fonts.displayBold, fontSize: 14, color: colors.navy },
  centerLabel: { fontFamily: fonts.bodySemibold, fontSize: 8.5, letterSpacing: 0.6, color: colors.navy2, marginTop: 1 },
  legend: { flex: 1, minWidth: 0, gap: 3 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, borderRadius: 8 },
  legendItemPressed: { backgroundColor: colors.appBg },
  legendDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  // Legend sits in a flexible flex:1 column (not a fixed circle), so it can
  // safely sit closer to the app-wide scale — numberOfLines={1} on the
  // label already handles a long category/city name gracefully.
  legendLabel: { flex: 1, minWidth: 0, fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.navy2 },
  legendPct: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.navy2, fontVariant: ["tabular-nums"] },
});
