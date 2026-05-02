import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
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

import { GradientButton } from "@/components/GradientButton";
import colors from "@/constants/colors";
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

// Brand status colors (brand-system.md §Status Colors)
const STATUS_COLOR: Record<GarmentStatus, string> = {
  clean: "#22C55E",
  worn: "#64748B",
  laundry: "#F97316",
};

const STATUS_LABEL: Record<GarmentStatus, string> = {
  clean: "Clean",
  worn: "Worn",
  laundry: "In laundry",
};

function GarmentCard({ garment, onLongPress }: { garment: Garment; onLongPress: () => void }) {
  const palette = useColors();
  return (
    <Pressable
      style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
      onLongPress={onLongPress}
      delayLongPress={400}
    >
      <Image source={{ uri: garment.imageUri }} style={styles.cardImage} contentFit="cover" />
      <View style={styles.cardOverlay}>
        <View style={styles.cardMeta}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[garment.status] }]} />
          <Text style={[styles.cardName, { color: palette.foreground }]} numberOfLines={1}>
            {garment.name}
          </Text>
        </View>
        <Text style={[styles.cardColor, { color: palette.mutedForeground }]} numberOfLines={1}>
          {garment.color}
        </Text>
      </View>
    </Pressable>
  );
}

export default function ClosetScreen() {
  const palette = useColors();
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
    Alert.alert(garment.name, undefined, [
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
    ]);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: palette.background,
          paddingTop: Platform.OS === "web" ? 67 : insets.top,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.foreground }]}>My Closet</Text>
        <Pressable
          testID="add-garment-button"
          onPress={() => router.push("/(garment)/add")}
          style={styles.addBtnWrapper}
        >
          <LinearGradient
            colors={colors.gradientPrimary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.addBtn}
          >
            <Feather name="plus" size={18} color="#FFFFFF" />
          </LinearGradient>
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
              onPress={() => setActiveCategory(key as GarmentCategory | "all")}
              style={styles.filterPillWrapper}
            >
              {active ? (
                <LinearGradient
                  colors={colors.gradientPrimary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.filterPillActive}
                >
                  <Text style={styles.filterLabelActive}>{label}</Text>
                </LinearGradient>
              ) : (
                <View
                  style={[
                    styles.filterPillInactive,
                    { backgroundColor: palette.card, borderColor: palette.border },
                  ]}
                >
                  <Text style={[styles.filterLabelInactive, { color: palette.mutedForeground }]}>
                    {label}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Content */}
      {garments.length === 0 && !isLoading ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconWrap, { backgroundColor: palette.muted }]}>
            <Feather name="shopping-bag" size={32} color={palette.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: palette.foreground }]}>
            Your closet is empty
          </Text>
          <Text style={[styles.emptyBody, { color: palette.mutedForeground }]}>
            Photograph your garments and Vision AI will classify them automatically.
          </Text>
          <GradientButton
            onPress={() => router.push("/(garment)/add")}
            label="Add garment"
            testID="add-first-garment-button"
            leftElement={<Feather name="camera" size={16} color="#FFFFFF" />}
            style={styles.addFirstBtn}
          />

          {/* Status legend */}
          <View style={styles.legend}>
            {(Object.entries(STATUS_LABEL) as [GarmentStatus, string][]).map(([status, label]) => (
              <View key={status} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: STATUS_COLOR[status] }]} />
                <Text style={[styles.legendText, { color: palette.mutedForeground }]}>{label}</Text>
              </View>
            ))}
          </View>
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
          renderItem={({ item }) => (
            <GarmentCard garment={item} onLongPress={() => handleLongPress(item)} />
          )}
          ListEmptyComponent={
            <View style={styles.filteredEmpty}>
              <Text style={[styles.filteredEmptyText, { color: palette.mutedForeground }]}>
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
  addBtnWrapper: {},
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  filterRow: { paddingHorizontal: 16, paddingBottom: 14, gap: 8, flexDirection: "row" },
  filterPillWrapper: {},
  filterPillActive: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  filterLabelActive: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  filterPillInactive: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterLabelInactive: { fontSize: 13, fontFamily: "Inter_500Medium" },
  grid: { paddingHorizontal: 12, paddingTop: 4 },
  row: { gap: 10, marginBottom: 10 },
  card: { flex: 1, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
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
  addFirstBtn: { marginTop: 4 },
  legend: { flexDirection: "row", gap: 16, marginTop: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  filteredEmpty: { flex: 1, alignItems: "center", paddingTop: 60 },
  filteredEmptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
});
