import React from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { useAmountVisibility } from "@/components/AmountVisibility";

interface Props {
  invoiceCount: number;
  totalTracked: string;
  totalTrackedMasked: string;
  monthLabel: string;
  trendPercent: number;
}

export function StatStrip({ invoiceCount, totalTracked, totalTrackedMasked, monthLabel, trendPercent }: Props) {
  const { hidden, toggle } = useAmountVisibility();
  const isDown = trendPercent < 0;

  return (
    <LinearGradient
      colors={[colors.navy, "#123A63", colors.tealDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      locations={[0, 0.62, 1]}
      style={styles.strip}
    >
      <View style={styles.top}>
        <Text style={styles.label}>THIS MONTH</Text>
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel="Show or hide amounts"
          style={[styles.visToggle, hidden && styles.visToggleActive]}
        >
          {hidden ? (
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
              <Path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7Z" stroke="#052B26" strokeWidth={1.9} strokeLinejoin="round" />
              <Circle cx="12" cy="12" r="3" stroke="#052B26" strokeWidth={1.9} />
              <Path d="M4 20 20 4" stroke="#052B26" strokeWidth={1.9} strokeLinecap="round" />
            </Svg>
          ) : (
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
              <Path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7Z" stroke="#fff" strokeWidth={1.9} strokeLinejoin="round" />
              <Circle cx="12" cy="12" r="3" stroke="#fff" strokeWidth={1.9} />
            </Svg>
          )}
        </Pressable>
      </View>

      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
            {hidden ? "•••" : String(invoiceCount)}
          </Text>
          <Text style={styles.statLabel} numberOfLines={2}>
            {monthLabel.toUpperCase()} - INVOICES
          </Text>
        </View>
        <View style={[styles.stat, styles.statDivider]}>
          <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
            {hidden ? totalTrackedMasked : totalTracked}
          </Text>
          <Text style={styles.statLabel} numberOfLines={2}>
            {monthLabel.toUpperCase()} - TOTAL SPEND
          </Text>
        </View>
        <View style={styles.spacer} />
        <View style={[styles.trend, isDown && styles.trendDown]}>
          <Svg width={9} height={9} viewBox="0 0 24 24" fill="none">
            <Path
              d={isDown ? "M4 8 10 14 14 10 20 18" : "M4 16 10 10 14 14 20 6"}
              stroke={isDown ? "#FCA5A5" : "#8FF4E3"}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={[styles.trendText, isDown && styles.trendTextDown]}>
            {trendPercent > 0 ? "+" : ""}
            {trendPercent}%
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  strip: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: "#FDB515",
  },
  visToggle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  visToggleActive: { backgroundColor: colors.teal },
  row: { flexDirection: "row", alignItems: "center" },
  // flexShrink + minWidth: 0 let a stat block actually shrink instead of
  // forcing the row to overflow — combined with numberOfLines + adjusts-
  // FontSizeToFit on statValue in the JSX, a wide total (₹1,45,230-style)
  // shrinks itself down rather than pushing the trend pill off-screen.
  stat: { gap: 2, flexShrink: 1, minWidth: 0 },
  statDivider: {
    marginLeft: 16,
    paddingLeft: 16,
    borderLeftWidth: 1,
    borderLeftColor: "rgba(255,255,255,0.18)",
  },
  // Pulled back a little from the full app-wide scale (18 -> 21 was every
  // other value's ratio) — this is the widest, riskiest text in the strip
  // (a comma-formatted rupee total in bold), and the shrink safety above is
  // a fallback, not the primary fit strategy.
  statValue: {
    fontFamily: fonts.displayBold,
    fontSize: 18.5,
    color: "#fff",
    fontVariant: ["tabular-nums"],
  },
  // numberOfLines={2} in the JSX (not 1) — "<MON> - INVOICES"/"<MON> - TOTAL
  // SPEND" is exactly long enough to ellipsize at this width once the stat
  // block above has shrunk for a wide total; wrapping to a second line
  // keeps every word readable instead of clipping it. adjustsFontSizeToFit
  // doesn't fix this the way it does for statValue — react-native-web
  // doesn't implement it at all, and even natively the constraint here is
  // the shrunk container width, not the font size.
  statLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11.5,
    lineHeight: 14,
    color: "rgba(255,255,255,0.68)",
  },
  spacer: { flex: 1, minWidth: 8 },
  // flexShrink: 0 — this pill should never get squeezed into unreadable
  // text; the stat blocks give up room first.
  trend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    flexShrink: 0,
    backgroundColor: "rgba(0,194,168,0.22)",
    borderWidth: 1,
    borderColor: "rgba(0,194,168,0.5)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  trendText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    color: "#8FF4E3",
    fontVariant: ["tabular-nums"],
  },
  trendDown: {
    backgroundColor: "rgba(248,113,113,0.2)",
    borderColor: "rgba(248,113,113,0.5)",
  },
  trendTextDown: { color: "#FCA5A5" },
});
