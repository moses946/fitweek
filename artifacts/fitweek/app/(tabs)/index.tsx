import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Garment, GarmentCategory, GarmentStatus, useGarments } from "@/contexts/GarmentContext";
import { useColors } from "@/hooks/useColors";

const CATEGORIES: { key: GarmentCategory | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "tops", label: "Tops" },
  { key: "bottoms", label: "Bottoms" },
  { key: "dresses", label: "Dresses" },
  { key: "outerwear", label: "Outerwear" },
  { key: "shoes", label: "Shoes" },
  { key: "accessories", label: "Accessories" },
];

const STATUS_COLOR: Record<GarmentStatus, string> = {
  clean: "#34C759",
  worn: "#FF9500",
  laundry: "#FF3B30",
};

import React, { useState } from "react";

function GarmentCard({ garment, onLongPress }: { garment: Garment; onLongPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onLongPress={onLongPress}
      delayLongPress={400}
    >
      <Image source={{ uri: garment.imageUri }} style={styles.cardImage} contentFit="cover" />
      <View style={[styles.cardOverlay, { backgroundColor: colors.card }]}>
        <View style={styles.cardMeta}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[garment.status] }]} />
          <Text style={[styles.cardName, { color: colors.foreground }]} numberOfLines={1}>
            {garment.name}
          </Text>
        </View>
        <Text style={[styles.cardColor, { color: colors.mutedForeground }]} numberOfLines={1}>
          {garment.color}
        </Text>
      </View>
    </Pressable>
  );
}

export default function ClosetScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { garments, isLoading, markWorn, sendToLaundry, markClean, removeGarment } = useGarments();
  const [activeCategory, setActiveCategory] = useState<GarmentCategory | "all">("all");

  const filtered =
    activeCategory === "all"
      ? garments
      : garments.filter((g) => g.category === activeCategory);

  const handleLongPress = (garment: Garment) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const actions: Array<{ text: string; onPress: () => void; style?: "destructive" | "cancel" }> = [
      {
        text: garment.status === "clean" ? "Mark as worn" : "Mark as clean",
        onPress: () =>
          garment.status === "clean" ? markWorn(garment.id) : markClean(garment.id),
      },
      { text: "Send to laundry", onPress: () => sendToLaundry(garment.id) },
      {
        text: "Remove garment",
        style: "destructive",
        onPress: () =>
          Alert.alert("Remove garment", "This cannot be undone.", [
            { text: "Cancel", style: "cancel" },
            { text: "Remove", style: "destructive", onPress: () => removeGarment(garment.id) },
          ]),
      },
      { text: "Cancel", style: "cancel", onPress: () => {} },
    ];
    Alert.alert(garment.name, undefined, actions);
  };

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
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>My Closet</Text>
        <Pressable
          testID="add-garment-button"
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/(garment)/add")}
        >
          <Feather name="plus" size={18} color={colors.primaryForeground} />
        </Pressable>
      </View>

      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {CATEGORIES.map(({ key, label }) => {
          const active = activeCategory === key;
          return (
            <Pressable
              key={key}
              style={[
                styles.filterPill,
                {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setActiveCategory(key as GarmentCategory | "all")}
            >
              <Text
                style={[
                  styles.filterLabel,
                  { color: active ? colors.primaryForeground : colors.mutedForeground },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Content */}
      {garments.length === 0 && !isLoading ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.muted }]}>
            <Feather name="shopping-bag" size={32} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your closet is empty</Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
            Photograph your garments and Vision AI will classify them automatically.
          </Text>
          <Pressable
            style={[styles.addFirstBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(garment)/add")}
            testID="add-first-garment-button"
          >
            <Feather name="camera" size={16} color={colors.primaryForeground} />
            <Text style={[styles.addFirstText, { color: colors.primaryForeground }]}>Add garment</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={[
            styles.grid,
            { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 80 },
          ]}
          columnWrapperStyle={styles.row}
          scrollEnabled={!!filtered.length}
          renderItem={({ item }) => (
            <GarmentCard garment={item} onLongPress={() => handleLongPress(item)} />
          )}
          ListEmptyComponent={
            <View style={styles.filteredEmpty}>
              <Text style={[styles.filteredEmptyText, { color: colors.mutedForeground }]}>
                No {activeCategory} yet
              </Text>
            </View>
          }
        />
      )}
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
  title: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  filterRow: { paddingHorizontal: 16, paddingBottom: 14, gap: 8, flexDirection: "row" },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  filterLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  grid: { paddingHorizontal: 12, paddingTop: 4 },
  row: { gap: 10, marginBottom: 10 },
  card: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardImage: { width: "100%", aspectRatio: 0.75 },
  cardOverlay: { padding: 10 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  cardName: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  cardColor: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
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
  emptyTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  emptyBody: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 21 },
  addFirstBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 14,
    gap: 8,
    marginTop: 4,
  },
  addFirstText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  filteredEmpty: { flex: 1, alignItems: "center", paddingTop: 60 },
  filteredEmptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
});
