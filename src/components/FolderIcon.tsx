import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { colors } from "@/theme/colors";
import type { FolderIconKey } from "@/data/folders";

interface Props {
  name: FolderIconKey;
  size?: number;
  color?: string;
}

export function FolderIcon({ name, size = 17, color = colors.tealDark }: Props) {
  const sw = 1.8;
  switch (name) {
    case "Groceries":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M3 4h2l2.4 11.6a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 1.95-1.55L20 8H6.2" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx="10" cy="20" r="1.4" fill={color} />
          <Circle cx="17" cy="20" r="1.4" fill={color} />
        </Svg>
      );
    case "Food":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M6 3v8a2 2 0 0 0 2 2v8M6 3a2 2 0 0 0-2 2v4M9 3v6M18 3c-1.7 0-3 2-3 5s1.3 5 3 5v8" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case "Healthcare":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 4 4 7v6c0 4.2 3.2 6.8 8 8.5 4.8-1.7 8-4.3 8-8.5V7l-8-3Z" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <Path d="M12 9v6M9 12h6" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case "Travel":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M21 3 3 10l7 3 3 7 8-17Z" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <Path d="M21 3 10 13" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case "Entertainment":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x="3" y="5" width="18" height="13" rx="1.5" stroke={color} strokeWidth={sw} />
          <Path d="M10 9.3v4.4l3.8-2.2L10 9.3Z" fill={color} />
        </Svg>
      );
    case "Beauty":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 3c.6 3.4 2.6 5.4 6 6-3.4.6-5.4 2.6-6 6-.6-3.4-2.6-5.4-6-6 3.4-.6 5.4-2.6 6-6Z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
        </Svg>
      );
    case "Apparels":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M9 4h6l1 2 4 2-2 3-2-1v9a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-9l-2 1-2-3 4-2 1-2Z" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
        </Svg>
      );
    case "Stationery":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M4 20l1-4.5L15.5 5l3.5 3.5L8.5 19 4 20Z" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <Path d="M13 7l3.5 3.5" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case "Religion":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 3c-1.6 2-1.6 4 0 5.6C13.6 7 13.6 5 12 3Z" fill={color} />
          <Path d="M3 15c0 2.8 4 4.6 9 4.6s9-1.8 9-4.6" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case "Automobile":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M4 16v-3l2-4h9l3 4v3" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <Path d="M3 16h18v2H3z" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <Circle cx="7.5" cy="18.5" r="1.6" fill={color} />
          <Circle cx="17" cy="18.5" r="1.6" fill={color} />
        </Svg>
      );
    case "Hardware":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M14.5 6.5a3.5 3.5 0 0 1-4.6 4.6L4 17v3h3l5.9-5.9a3.5 3.5 0 0 1 4.6-4.6L14.5 6.5Z" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
        </Svg>
      );
    case "Housekeeping":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M14.5 3.5 20.5 9.5" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M12.5 5.5 6 12c-1.4 1.4-1.4 3.7 0 5.1 1.4 1.4 3.7 1.4 5.1 0l6.5-6.5" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <Path d="M8 15l2.5 2.5M11 12l2.5 2.5" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case "Furniture":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M6 4v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Rect x="5" y="13" width="14" height="5" rx="1.2" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <Path d="M6 18v2M18 18v2" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case "Gas":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M10 7V5a2 2 0 0 1 2-2 2 2 0 0 1 2 2v2" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Rect x="7" y="7" width="10" height="14" rx="2.2" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <Path d="M8.5 11.5h7" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="6" cy="6" r="2" fill={color} />
          <Circle cx="12" cy="6" r="2" fill={color} />
          <Circle cx="18" cy="6" r="2" fill={color} />
          <Circle cx="6" cy="12" r="2" fill={color} />
          <Circle cx="12" cy="12" r="2" fill={color} />
          <Circle cx="18" cy="12" r="2" fill={color} />
        </Svg>
      );
  }
}
