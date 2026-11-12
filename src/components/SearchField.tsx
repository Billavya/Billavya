import React from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}

export function SearchField({ value, onChangeText, placeholder }: Props) {
  return (
    <View style={styles.field}>
      <Svg width={11.3} height={11.3} viewBox="0 0 24 24" fill="none">
        <Circle cx="11" cy="11" r="7" stroke={colors.muted2} strokeWidth={2} />
        <Path d="m20 20-3.5-3.5" stroke={colors.muted2} strokeWidth={2} strokeLinecap="round" />
      </Svg>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted2}
        autoCorrect={false}
      />
      {/* Explicit, cross-platform clear button — TextInput's own
          clearButtonMode is iOS-only and silently does nothing on Android,
          which left Android with no visible way to clear the field at all. */}
      {value.length > 0 && (
        <Pressable
          onPress={() => onChangeText("")}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          style={styles.clearBtn}
          hitSlop={8}
        >
          <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="12" r="10" fill={colors.line} />
            <Line x1="8.5" y1="8.5" x2="15.5" y2="15.5" stroke={colors.muted} strokeWidth={1.8} strokeLinecap="round" />
            <Line x1="15.5" y1="8.5" x2="8.5" y2="15.5" stroke={colors.muted} strokeWidth={1.8} strokeLinecap="round" />
          </Svg>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 30,
    paddingHorizontal: 9,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9.8,
  },
  input: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 10.1,
    color: colors.navy2,
    padding: 0,
  },
  clearBtn: {
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
