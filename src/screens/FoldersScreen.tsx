import React, { useMemo } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/fonts";
import { FolderRow } from "@/components/FolderCard";
import { useCombinedInvoices } from "@/hooks/useCombinedInvoices";

export function FoldersScreen() {
  const navigation = useNavigation<any>();
  const { folders } = useCombinedInvoices();
  const alphabetical = useMemo(() => [...folders].sort((a, b) => a.name.localeCompare(b.name)), [folders]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>All Folders</Text>
        <Text style={styles.subtitle}>Every category, A to Z.</Text>
      </View>
      <FlatList
        data={alphabetical}
        keyExtractor={(item) => item.name}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <FolderRow folder={item} onPress={() => navigation.navigate("FolderDetail", { folderName: item.name })} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.appBg },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  title: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.navy },
  subtitle: { fontFamily: fonts.bodyRegular, fontSize: 12.5, color: colors.muted, marginTop: 4 },
  listContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
});
