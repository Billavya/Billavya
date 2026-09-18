import React, { useState } from "react";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { QuickQrModal } from "@/components/QuickQrModal";

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

// The "Folders" route/screen is unchanged — only its bottom-bar label reads "Special".
const TAB_LABELS: Record<string, string> = { Folders: "Special" };

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [qrOpen, setQrOpen] = useState(false);

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
        <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]} numberOfLines={1}>
          {TAB_LABELS[routeName] ?? routeName}
        </Text>
      </Pressable>
    );
  }

  function renderQrTab() {
    return (
      <Pressable
        key="qr"
        accessibilityRole="button"
        accessibilityLabel="Show your SnapBill QR code"
        onPress={() => setQrOpen(true)}
        style={styles.tab}
      >
        <View style={styles.qrBadge}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.2" stroke="#FFFFFF" strokeWidth={2} />
            <Rect x="14" y="3.5" width="6.5" height="6.5" rx="1.2" stroke="#FFFFFF" strokeWidth={2} />
            <Rect x="3.5" y="14" width="6.5" height="6.5" rx="1.2" stroke="#FFFFFF" strokeWidth={2} />
            <Rect x="14.5" y="14.5" width="2.2" height="2.2" rx="0.4" fill={colors.teal} />
            <Rect x="18.5" y="14.5" width="2.2" height="2.2" rx="0.4" fill={colors.teal} />
            <Rect x="14.5" y="18.5" width="2.2" height="2.2" rx="0.4" fill={colors.teal} />
            <Rect x="18.5" y="18.5" width="2.2" height="2.2" rx="0.4" fill={colors.teal} />
          </Svg>
        </View>
        <Text style={[styles.tabLabel, styles.qrLabel]}>QR</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.bar}>
        {LEFT_TABS.map(renderTab)}
        {renderQrTab()}
        {RIGHT_TABS.map(renderTab)}
      </View>

      <QuickQrModal visible={qrOpen} onClose={() => setQrOpen(false)} />
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
  tabLabel: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.muted2 },
  tabLabelActive: { color: colors.tealDark },
  qrBadge: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.navy,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  qrLabel: { color: colors.tealDark },
});
