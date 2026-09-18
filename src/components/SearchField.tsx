import React from "react";
import { StyleSheet, TextInput, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
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
      <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
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
        clearButtonMode="while-editing"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 40,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
  },
  input: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 13.5,
    color: colors.navy2,
    padding: 0,
  },
});
