import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

export function InsightsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.stub}>
        <View style={styles.iconWrap}>
          <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
            <Path d="M4 19V11M10 19V5M16 19v-7M20 19V9" stroke={colors.tealDark} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </View>
        <Text style={styles.title}>Insights are on the way</Text>
        <Text style={styles.body}>Month-over-month trends and category breakdowns for your 12 folders will show up here.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.appBg },
  stub: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 14 },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.tealTint,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: fonts.displayBold, fontSize: 15, color: colors.navy, textAlign: "center" },
  body: { fontFamily: fonts.bodyRegular, fontSize: 12.5, lineHeight: 18, color: colors.muted, textAlign: "center", maxWidth: 260 },
});
