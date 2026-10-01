import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { colors } from "@/theme/colors";

export type ExclusiveKind = "gift" | "warranty" | "split" | "transferred" | "received" | "other";

export const EXCLUSIVE_KINDS: {
  kind: ExclusiveKind;
  name: string;
  blurb: string;
  bg: string;
  border: string;
  icon: (color: string) => React.ReactNode;
}[] = [
  {
    kind: "gift",
    name: "Gifts",
    blurb: "Invoices tagged as a gift for someone",
    bg: "#FFFBEB",
    border: "#FDE68A",
    icon: (c) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Rect x="3.5" y="9" width="17" height="10" rx="1.2" stroke={c} strokeWidth={1.8} />
        <Rect x="3.5" y="6" width="17" height="4" rx="1" stroke={c} strokeWidth={1.8} />
        <Path d="M12 6v13" stroke={c} strokeWidth={1.8} />
        <Path d="M12 6c-1.5-3-5-3-5-.5S9.5 6 12 6ZM12 6c1.5-3 5-3 5-.5S14.5 6 12 6Z" stroke={c} strokeWidth={1.6} strokeLinejoin="round" />
      </Svg>
    ),
  },
  {
    kind: "warranty",
    name: "Warranty",
    blurb: "Products covered by a warranty",
    bg: colors.tealTint,
    border: colors.teal,
    icon: (c) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M12 3 5 6v5c0 4.2 3 7.5 7 9 4-1.5 7-4.8 7-9V6l-7-3Z" stroke={c} strokeWidth={1.8} strokeLinejoin="round" />
        <Path d="M9 12l2 2 4-4" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
  {
    kind: "split",
    name: "Split",
    blurb: "Invoices you've split the bill on",
    bg: "#F3E8FF",
    border: "#DDD6FE",
    icon: (c) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 3v6M8 6l4 3 4-3M6 21v-6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6"
          stroke={c}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    ),
  },
  {
    kind: "transferred",
    name: "Transferred",
    blurb: "Invoices you've handed off to someone",
    bg: "#FEF2F2",
    border: "#FECACA",
    icon: (c) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M4 12h12M12 6l6 6-6 6" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
  {
    kind: "received",
    name: "Received",
    blurb: "Invoices someone transferred to you",
    bg: "#EAF1FF",
    border: "#BFDBFE",
    icon: (c) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M20 12H8M14 6l-6 6 6 6" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
  {
    kind: "other",
    name: "Others",
    blurb: "Anything else worth keeping separate",
    bg: colors.appBg,
    border: colors.line,
    icon: (c) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M11 4H5a1 1 0 0 0-1 1v6l9 9 7-7-9-9Z" stroke={c} strokeWidth={1.8} strokeLinejoin="round" />
        <Circle cx="7.5" cy="7.5" r="1.2" fill={c} />
      </Svg>
    ),
  },
];
