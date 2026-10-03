import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { FOLDERS } from "@/data/folders";
import { FolderIcon } from "@/components/FolderIcon";
import { useToast } from "@/components/Toast";
import { useCombinedInvoices } from "@/hooks/useCombinedInvoices";
import { CITY_LIST } from "@/utils/location";
import { DatePickerModal } from "@/components/DatePickerModal";
import { formatDDMonYYYY, parseDateLabel, startOfDay, endOfDay } from "@/utils/dateLabel";
import { LOCALE } from "@/config/locale";

const CITY_OPTIONS = ["All Cities", ...CITY_LIST];

/** Earliest date either field can be set to — nothing before Avyaya's own launch month. */
const EARLIEST_SEARCH_DATE = new Date(2026, 0, 1);

// Was "1st of the current calendar month" — looked broken right at a month
// boundary: on Oct 2, that default is a 2-day-wide window (Oct 1-2), so any
// invoice from late September (even yesterday-ish) silently fell outside it
// and the screen showed "0" even though the invoices were real and recent.
// A rolling 30-day lookback never resets to near-zero just because the
// calendar flipped a page.
function defaultFromDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d;
}

function laterOf(a: Date, b: Date): Date {
  return a.getTime() > b.getTime() ? a : b;
}

export function SearchScreen() {
  const navigation = useNavigation<any>();
  const { showToast } = useToast();
  const { invoices } = useCombinedInvoices();
  const [query, setQuery] = useState("");
  const [cityIndex, setCityIndex] = useState(0);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [fromDate, setFromDate] = useState<Date>(defaultFromDate);
  const [toDate, setToDate] = useState<Date>(() => new Date());
  const [pickerOpen, setPickerOpen] = useState<"from" | "to" | null>(null);

  const selectedCount = Object.keys(selected).length;
  const selectedCity = cityIndex === 0 ? null : CITY_OPTIONS[cityIndex];
  const rangeStartMs = startOfDay(fromDate).getTime();
  const rangeEndMs = endOfDay(toDate).getTime();

  const matchCount = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (inv.transferredTo) return false; // transferred invoices aren't counted anywhere
      if (selectedCount && !selected[inv.folder]) return false;
      if (selectedCity && inv.location !== selectedCity) return false;
      const ts = parseDateLabel(inv.date);
      if (ts != null && (ts < rangeStartMs || ts > rangeEndMs)) return false;
      if (!q) return true;
      return inv.store.toLowerCase().includes(q) || inv.folder.toLowerCase().includes(q);
    }).length;
  }, [invoices, query, selected, selectedCount, selectedCity, rangeStartMs, rangeEndMs]);

  function toggleCategory(name: string) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[name]) delete next[name];
      else next[name] = true;
      return next;
    });
  }

  function clearAll() {
    setQuery("");
    setSelected({});
    setCityIndex(0);
    setFromDate(defaultFromDate());
    setToDate(new Date());
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Search</Text>
        <Text style={styles.subtitle}>Find any invoice in seconds.</Text>
      </View>

      <View style={styles.searchActive}>
        <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
          <Circle cx="11" cy="11" r="7" stroke={colors.navy2} strokeWidth={2} />
          <Path d="m20 20-3.5-3.5" stroke={colors.navy2} strokeWidth={2} strokeLinecap="round" />
        </Svg>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search invoices, stores…"
          placeholderTextColor={colors.muted2}
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable style={styles.clearBtn} onPress={() => setQuery("")} accessibilityLabel="Clear search">
            <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
              <Path d="M5 5l14 14M19 5 5 19" stroke={colors.muted2} strokeWidth={2.4} strokeLinecap="round" />
            </Svg>
          </Pressable>
        )}
      </View>

      <ScrollView style={styles.filters} contentContainerStyle={styles.filtersContent}>
        <View style={styles.filterGroup}>
          <View style={styles.flabel}>
            <Text style={styles.flabelName}>Location</Text>
          </View>
          <View style={styles.fieldRow}>
            <Pressable style={styles.field} onPress={() => setCityIndex((i) => (i + 1) % CITY_OPTIONS.length)}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M12 21s7-7.4 7-12.4A7 7 0 0 0 5 8.6C5 13.6 12 21 12 21Z" stroke={colors.tealDark} strokeWidth={1.8} strokeLinejoin="round" />
                <Circle cx="12" cy="8.6" r="2.4" stroke={colors.tealDark} strokeWidth={1.8} />
              </Svg>
              <View style={styles.ftext}>
                <Text style={styles.flab}>CITY</Text>
                <Text style={styles.fval}>{CITY_OPTIONS[cityIndex]}</Text>
              </View>
              <Chevron />
            </Pressable>
            <Pressable style={styles.field} onPress={() => showToast(`Only ${LOCALE.country} is supported right now.`)}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="12" r="8.2" stroke={colors.tealDark} strokeWidth={1.8} />
                <Path d="M3.8 12h16.4M12 3.8c2.4 2.3 3.4 5 3.4 8.2s-1 5.9-3.4 8.2c-2.4-2.3-3.4-5-3.4-8.2s1-5.9 3.4-8.2Z" stroke={colors.tealDark} strokeWidth={1.8} />
              </Svg>
              <View style={styles.ftext}>
                <Text style={styles.flab}>COUNTRY</Text>
                <Text style={styles.fval}>{LOCALE.country}</Text>
              </View>
              <Chevron />
            </Pressable>
          </View>
        </View>

        <View style={styles.filterGroup}>
          <View style={styles.flabel}>
            <Text style={styles.flabelName}>Date Range</Text>
          </View>
          <View style={styles.fieldRow}>
            <Pressable style={styles.field} onPress={() => setPickerOpen("from")}>
              <CalendarIcon />
              <View style={styles.ftext}>
                <Text style={styles.flab}>FROM</Text>
                <Text style={styles.fval}>{formatDDMonYYYY(fromDate)}</Text>
              </View>
            </Pressable>
            <Pressable style={styles.field} onPress={() => setPickerOpen("to")}>
              <CalendarIcon />
              <View style={styles.ftext}>
                <Text style={styles.flab}>TO</Text>
                <Text style={styles.fval}>{formatDDMonYYYY(toDate)}</Text>
              </View>
            </Pressable>
          </View>
        </View>

        <View style={styles.filterGroup}>
          <View style={styles.flabel}>
            <Text style={styles.flabelName}>Category</Text>
            <Text style={styles.flabelHint}>{selectedCount} selected</Text>
          </View>
          <View style={styles.chipWrap}>
            {FOLDERS.map((f) => {
              const on = !!selected[f.name];
              return (
                <Pressable key={f.name} style={[styles.chip, on && styles.chipOn]} onPress={() => toggleCategory(f.name)}>
                  <View style={[styles.chipIcon, on && styles.chipIconOn]}>
                    <FolderIcon name={f.name} size={11} color={colors.gold} />
                  </View>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{f.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={styles.applyBar}>
        <Pressable onPress={clearAll}>
          <Text style={styles.clearAll}>Clear all</Text>
        </Pressable>
        <Pressable
          style={styles.applyBtn}
          onPress={() =>
            navigation.navigate("SearchResults", {
              query,
              categories: Object.keys(selected),
              city: selectedCity,
              fromMs: rangeStartMs,
              toMs: rangeEndMs,
            })
          }
        >
          <Text style={styles.applyBtnText}>Apply Filters</Text>
          <View style={styles.applyCount}>
            <Text style={styles.applyCountText}>{matchCount}</Text>
          </View>
        </Pressable>
      </View>

      <DatePickerModal
        visible={pickerOpen === "from"}
        label="From"
        initialDate={fromDate}
        minDate={EARLIEST_SEARCH_DATE}
        maxDate={toDate}
        onClose={() => setPickerOpen(null)}
        onSelect={(d) => {
          setFromDate(d);
          setPickerOpen(null);
        }}
      />
      <DatePickerModal
        visible={pickerOpen === "to"}
        label="To"
        initialDate={toDate}
        minDate={laterOf(fromDate, EARLIEST_SEARCH_DATE)}
        onClose={() => setPickerOpen(null)}
        onSelect={(d) => {
          setToDate(d);
          setPickerOpen(null);
        }}
      />
    </SafeAreaView>
  );
}

function Chevron() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
      <Path d="m6 9 6 6 6-6" stroke={colors.muted2} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CalendarIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke={colors.tealDark} strokeWidth={1.8} />
      <Path d="M8 3v4M16 3v4M3.5 10h17" stroke={colors.tealDark} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.appBg },
  titleBlock: { paddingHorizontal: 20, paddingTop: 12 },
  title: { fontFamily: fonts.displayBold, fontSize: 21.5, color: colors.navy },
  subtitle: { fontFamily: fonts.bodyRegular, fontSize: 13.5, color: colors.muted, marginTop: 2 },
  searchActive: {
    marginHorizontal: 20,
    marginTop: 12,
    height: 46,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.teal,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: colors.teal,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  searchInput: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14.5, color: colors.navy2, padding: 0 },
  clearBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.appBg,
    alignItems: "center",
    justifyContent: "center",
  },
  filters: { flex: 1, marginHorizontal: 20, marginTop: 16 },
  filtersContent: { gap: 16, paddingBottom: 8 },
  filterGroup: {},
  flabel: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  flabelName: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase", color: colors.muted },
  flabelHint: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.tealDark },
  fieldRow: { flexDirection: "row", gap: 9 },
  field: {
    flex: 1,
    minWidth: 0,
    height: 50,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  ftext: { flex: 1, minWidth: 0 },
  flab: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.muted2, marginBottom: 2 },
  fval: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.navy2 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  chipIconOn: { backgroundColor: "rgba(255,255,255,0.16)" },
  chipText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.navy2 },
  chipTextOn: { color: "#fff" },
  applyBar: { flexDirection: "row", alignItems: "center", gap: 14, marginHorizontal: 20, marginTop: 14, marginBottom: 16 },
  clearAll: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.muted },
  applyBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.tealDark,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  applyBtnText: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: "#fff" },
  applyCount: { backgroundColor: "rgba(255,255,255,0.22)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  applyCountText: { fontFamily: fonts.bodyBold, fontSize: 13, color: "#fff" },
});
