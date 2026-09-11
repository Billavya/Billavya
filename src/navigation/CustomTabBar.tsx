import React, { useState } from "react";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { ScanModal } from "@/components/ScanModal";

const ICONS: Record<string, (active: boolean) => React.ReactNode> = {
  Home: (active) => (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M4 11 12 4l8 7" stroke={active ? colors.tealDark : colors.muted2} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" stroke={active ? colors.tealDark : colors.muted2} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  ),
  Insights: (active) => (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M4 19V11M10 19V5M16 19v-7M20 19V9" stroke={active ? colors.tealDark : colors.muted2} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  ),
  Search: (active) => (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="7" stroke={active ? colors.tealDark : colors.muted2} strokeWidth={2} />
      <Path d="m20 20-3.5-3.5" stroke={active ? colors.tealDark : colors.muted2} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  ),
  Folders: (active) => (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 8a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z"
        stroke={active ? colors.tealDark : colors.muted2}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  ),
  Profile: (active) => (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="3.4" stroke={active ? colors.tealDark : colors.muted2} strokeWidth={2} />
      <Path d="M5 20c1.2-3.4 4-5 7-5s5.8 1.6 7 5" stroke={active ? colors.tealDark : colors.muted2} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  ),
};

const LEFT_TABS = ["Home", "Insights", "Search"];
const RIGHT_TABS = ["Folders", "Profile"];

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [scanOpen, setScanOpen] = useState(false);

  function renderTab(routeName: string) {
    const route = state.routes.find((r) => r.name === routeName);
    if (!route) return null;
    const index = state.routes.indexOf(route);
    const isFocused = state.index === index;

    return (
      <Pressable
        key={route.key}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        onPress={() => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
        style={styles.tab}
      >
        {ICONS[routeName]?.(isFocused)}
        <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>{routeName}</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.ring} pointerEvents="none" />
      <Pressable style={styles.scanBtn} accessibilityLabel="Scan a receipt" onPress={() => setScanOpen(true)}>
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path d="M4 8V5a1 1 0 0 1 1-1h3M20 8V5a1 1 0 0 0-1-1h-3M4 16v3a1 1 0 0 0 1 1h3M20 16v3a1 1 0 0 1-1 1h-3" stroke="#052B26" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M15 15h2.5M15 19h6M20 15v6" stroke="#052B26" strokeWidth={2} strokeLinecap="round" />
        </Svg>
      </Pressable>

      <View style={styles.bar}>
        {LEFT_TABS.map(renderTab)}
        <View style={styles.spacer} />
        {RIGHT_TABS.map(renderTab)}
      </View>

      <ScanModal visible={scanOpen} onClose={() => setScanOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.appBg, paddingTop: 6 },
  bar: {
    marginHorizontal: 14,
    height: 62,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    shadowColor: colors.navy,
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  tab: { alignItems: "center", justifyContent: "center", gap: 3, width: 48, height: "100%" },
  tabLabel: { fontFamily: fonts.bodySemibold, fontSize: 9, color: colors.muted2 },
  tabLabelActive: { color: colors.tealDark },
  spacer: { width: 56 },
  scanBtn: {
    position: "absolute",
    left: "50%",
    top: -24,
    marginLeft: -30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.teal,
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    borderWidth: 6,
    borderColor: colors.appBg,
    zIndex: 2,
  },
  ring: {
    position: "absolute",
    left: "50%",
    top: -24,
    marginLeft: -30,
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: "rgba(0,194,168,0.4)",
  },
});
