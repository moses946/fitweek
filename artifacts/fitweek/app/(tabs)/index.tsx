import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
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
import brandColors from "@/constants/colors";
import { Garment, GarmentCategory, GarmentStatus, useGarments } from "@/contexts/GarmentContext";
import { useColors } from "@/hooks/useColors";
import { isSkippedToday, isSkippedUntil } from "@/lib/suggestionFilter";

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
  clean: "#10B981",
  worn: "#64748B",
  laundry: "#0EA5E9",
};

interface UndoToastProps {
  name: string;
  onUndo: () => void;
  opacity: Animated.Value;
}

function UndoToast({ name, onUndo, opacity }: UndoToastProps) {
  const colors = useColors();
  return (
    <Animated.View
      style={[styles.undoToast, { backgroundColor: colors.foreground, opacity }]}
    >
      <Text style={[styles.undoText, { color: colors.background }]} numberOfLines={1}>
        "{name}" removed
      </Text>
      <Pressable onPress={onUndo} hitSlop={12}>
        <Text style={[styles.undoBtn, { color: brandColors.gradientPrimary[0] }]}>Undo</Text>
      </Pressable>
    </Animated.View>
  );
}

function GarmentCard({
  garment,
  onLongPress,
}: {
  garment: Garment;
  onLongPress: () => void;
}) {
  const colors = useColors();
  const today = new Date();
  const skipped = isSkippedToday(garment, today) || isSkippedUntil(garment, today);

  return (
    <Pressable
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: skipped ? 0.5 : 1 },
      ]}
      onLongPress={onLongPress}
      delayLongPress={400}
    >
      <Image source={{ uri: garment.imageUri }} style={styles.cardImage} contentFit="cover" />
      {skipped && (
        <View style={[styles.skippedBadge, { backgroundColor: colors.surfaceWash }]}>
          <Text style={[styles.skippedText, { color: colors.mutedForeground }]}>Skipped</Text>
        </View>
      )}
      {/* Status dot — top right */}
      <View style={[styles.statusDotAbsolute, { backgroundColor: STATUS_COLOR[garment.status] }]} />
      <View style={styles.cardBottom}>
        <Text style={[styles.cardName, { color: colors.foreground }]} numberOfLines={1}>
          {garment.name}
        </Text>
        <Text style={[styles.cardCategory, { color: colors.mutedForeground }]} numberOfLines={1}>
          {garment.category.toUpperCase()}
        </Text>
      </View>
    </Pressable>
  );
}

interface PendingUndo {
  id: string;
  name: string;
}

export default function ClosetScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    garments,
    isLoading,
    markWorn,
    sendToLaundry,
    markClean,
    skipForSession,
    skipForWeek,
    softDeleteGarment,
    restoreGarment,
    purgeGarment,
  } = useGarments();

  const [activeCategory, setActiveCategory] = useState<GarmentCategory | "all">("all");
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const purgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visible = garments.filter((g) => g.deletedAt === null);
  const filtered =
    activeCategory === "all"
      ? visible
      : visible.filter((g) => g.category === activeCategory);

  const showUndoToast = (id: string, name: string) => {
    if (purgeTimerRef.current) clearTimeout(purgeTimerRef.current);
    setPendingUndo({ id, name });
    Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    purgeTimerRef.current = setTimeout(() => { dismissUndo(id, true); }, 3000);
  };

  const dismissUndo = (id: string, shouldPurge: boolean) => {
    if (purgeTimerRef.current) clearTimeout(purgeTimerRef.current);
    Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(
      async () => {
        setPendingUndo(null);
        if (shouldPurge) await purgeGarment(id);
      },
    );
  };

  const handleUndo = async () => {
    if (!pendingUndo) return;
    if (purgeTimerRef.current) clearTimeout(purgeTimerRef.current);
    await restoreGarment(pendingUndo.id);
    Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setPendingUndo(null);
    });
  };

  useEffect(() => {
    return () => { if (purgeTimerRef.current) clearTimeout(purgeTimerRef.current); };
  }, []);

  const handleLongPress = (garment: Garment) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const today = new Date();
    const currentlySkipped = isSkippedToday(garment, today) || isSkippedUntil(garment, today);

    Alert.alert(garment.name, undefined, [
      {
        text: garment.status === "clean" ? "Mark as worn" : "Mark as clean",
        onPress: () =>
          garment.status === "clean" ? markWorn(garment.id) : markClean(garment.id),
      },
      { text: "Send to laundry", onPress: () => sendToLaundry(garment.id) },
      ...(!currentlySkipped
        ? [
            { text: "Skip today", onPress: () => skipForSession(garment.id) },
            { text: "Skip this week", onPress: () => skipForWeek(garment.id) },
          ]
        : [{ text: "Remove skip", onPress: () => markClean(garment.id) }]),
      {
        text: "Delete garment",
        style: "destructive" as const,
        onPress: async () => {
          await softDeleteGarment(garment.id);
          showUndoToast(garment.id, garment.name);
        },
      },
      { text: "Cancel", style: "cancel" as const, onPress: () => {} },
    ]);
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
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Wardrobe</Text>
          {visible.length > 0 && (
            <Text style={[styles.itemCount, { color: colors.mutedForeground }]}>
              {visible.length} {visible.length === 1 ? "item" : "items"}
            </Text>
          )}
        </View>
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
            >
              {active ? (
                <LinearGradient
                  colors={brandColors.gradientPrimary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.filterPillActive}
                >
                  <Text style={styles.filterLabelActive}>{label}</Text>
                </LinearGradient>
              ) : (
                <View
                  style={[
                    styles.filterPillInactive,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.filterLabelInactive, { color: colors.mutedForeground }]}>
                    {label}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Content */}
      {visible.length === 0 && !isLoading ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.surfaceWash }]}>
            <Feather name="shopping-bag" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Your wardrobe is empty
          </Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
            Photograph your garments and Vision AI will classify them automatically.
          </Text>
          <GradientButton
            onPress={() => router.push("/(garment)/add")}
            label="Add garment"
            testID="add-first-garment-button"
            leftElement={<Feather name="camera" size={16} color="#FFFFFF" />}
            style={styles.addFirstBtn}
          />
          <View style={styles.legend}>
            {(
              [
                ["clean", "#10B981", "Clean"],
                ["worn", "#64748B", "Worn"],
                ["laundry", "#0EA5E9", "In laundry"],
              ] as [string, string, string][]
            ).map(([key, color, label]) => (
              <View key={key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text style={[styles.legendText, { color: colors.mutedForeground }]}>{label}</Text>
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
              <Text style={[styles.filteredEmptyText, { color: colors.mutedForeground }]}>
                No {activeCategory} yet
              </Text>
            </View>
          }
        />
      )}

      {/* Floating + button */}
      <Pressable
        testID="add-garment-button"
        onPress={() => router.push("/(garment)/add")}
        style={styles.fab}
      >
        <LinearGradient
          colors={brandColors.gradientPrimary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <Feather name="plus" size={24} color="#FFFFFF" />
        </LinearGradient>
      </Pressable>

      {/* Undo toast */}
      {pendingUndo && (
        <UndoToast
          name={pendingUndo.name}
          onUndo={handleUndo}
          opacity={toastOpacity}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  title: { fontSize: 28, fontFamily: "Poppins_700Bold" },
  itemCount: { fontSize: 12, fontFamily: "Poppins_400Regular" },
  filterRow: { paddingHorizontal: 16, paddingBottom: 14, gap: 8, flexDirection: "row" },
  filterPillActive: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  filterLabelActive: { fontSize: 12, fontFamily: "Poppins_500Medium", color: "#FFFFFF" },
  filterPillInactive: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  filterLabelInactive: { fontSize: 12, fontFamily: "Poppins_500Medium" },
  grid: { paddingHorizontal: 12, paddingTop: 4 },
  row: { gap: 10, marginBottom: 10 },
  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardImage: { width: "100%", aspectRatio: 0.75 },
  skippedBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  skippedText: { fontSize: 10, fontFamily: "Poppins_600SemiBold" },
  statusDotAbsolute: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardBottom: { padding: 10, gap: 2 },
  cardName: { fontSize: 13, fontFamily: "Poppins_600SemiBold" },
  cardCategory: { fontSize: 11, fontFamily: "Poppins_500Medium", letterSpacing: 0.5 },
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
  emptyTitle: { fontSize: 20, fontFamily: "Poppins_600SemiBold", textAlign: "center" },
  emptyBody: { fontSize: 14, fontFamily: "Poppins_400Regular", textAlign: "center", lineHeight: 21 },
  addFirstBtn: { marginTop: 4 },
  legend: { flexDirection: "row", gap: 16, marginTop: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 11, fontFamily: "Poppins_400Regular" },
  filteredEmpty: { flex: 1, alignItems: "center", paddingTop: 60 },
  filteredEmptyText: { fontSize: 15, fontFamily: "Poppins_400Regular" },
  fab: {
    position: "absolute",
    bottom: 80,
    right: 20,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(139,47,245,0.30)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
  },
  undoToast: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  undoText: { fontSize: 14, fontFamily: "Poppins_400Regular", flex: 1, marginRight: 12 },
  undoBtn: { fontSize: 14, fontFamily: "Poppins_700Bold" },
});
