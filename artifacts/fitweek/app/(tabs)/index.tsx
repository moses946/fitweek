import { Feather } from "@expo/vector-icons";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const CATEGORIES = ["All", "Tops", "Bottoms", "Dresses", "Outerwear", "Shoes"];

export default function ClosetScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: Platform.OS === "web" ? 67 : insets.top,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>My Closet</Text>
        <Pressable
          testID="add-garment-button"
          style={[styles.headerAction, { backgroundColor: colors.primary }]}
        >
          <Feather name="plus" size={18} color={colors.primaryForeground} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {CATEGORIES.map((cat, i) => (
          <Pressable
            key={cat}
            style={[
              styles.filterPill,
              {
                backgroundColor: i === 0 ? colors.primary : colors.card,
                borderColor: i === 0 ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.filterLabel,
                { color: i === 0 ? colors.primaryForeground : colors.mutedForeground },
              ]}
            >
              {cat}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.emptyState}>
        <View style={[styles.emptyIconWrap, { backgroundColor: colors.muted }]}>
          <Feather name="shopping-bag" size={32} color={colors.mutedForeground} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
          Your closet is empty
        </Text>
        <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
          Photograph your garments and the app will classify them automatically.
        </Text>
        <Pressable
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          testID="add-first-garment-button"
        >
          <Feather name="camera" size={16} color={colors.primaryForeground} />
          <Text style={[styles.addButtonText, { color: colors.primaryForeground }]}>
            Add garment
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  filterRow: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
    flexDirection: "row",
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 16,
    paddingBottom: 80,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 14,
    gap: 8,
    marginTop: 4,
  },
  addButtonText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
