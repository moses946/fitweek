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
  clean: "#22C55E",
  worn: "#64748B",
  laundry: "#F97316",
};

// ─── Undo toast ───────────────────────────────────────────────────────────────

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
        <Text style={[styles.undoBtn, { color: "#7B61FF" }]}>Undo</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Garment card ─────────────────────────────────────────────────────────────

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
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: skipped ? 0.5 : 1 }]}
      onLongPress={onLongPress}
      delayLongPress={400}
    >
      <Image source={{ uri: garment.imageUri }} style={styles.cardImage} contentFit="cover" />
      {skipped && (
        <View style={[styles.skippedBadge, { backgroundColor: colors.muted }]}>
          <Text style={[styles.skippedText, { color: colors.mutedForeground }]}>Skipped</Text>
        </View>
      )}
      <View style={styles.cardOverlay}>
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

// ─── Main screen ──────────────────────────────────────────────────────────────

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

  // Visible garments: exclude soft-deleted
  const visible = garments.filter((g) => g.deletedAt === null);
  const filtered =
    activeCategory === "all"
      ? visible
      : visible.filter((g) => g.category === activeCategory);

  // ── Undo toast lifecycle ────────────────────────────────────────────────────

  const showUndoToast = (id: string, name: string) => {
    if (purgeTimerRef.current) clearTimeout(purgeTimerRef.current);

    setPendingUndo({ id, name });

    // Fade in
    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // Auto-purge after 3s
    purgeTimerRef.current = setTimeout(() => {
      dismissUndo(id, true);
    }, 3000);
  };

  const dismissUndo = (id: string, shouldPurge: boolean) => {
    if (purgeTimerRef.current) clearTimeout(purgeTimerRef.current);

    Animated.timing(toastOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(async () => {
      setPendingUndo(null);
      if (shouldPurge) await purgeGarment(id);
    });
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
    return () => {
      if (purgeTimerRef.current) clearTimeout(purgeTimerRef.current);
    };
  }, []);

  // ── Long-press menu ─────────────────────────────────────────────────────────

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
      {
        text: "Send to laundry",
        onPress: () => sendToLaundry(garment.id),
      },
      ...(!currentlySkipped
        ? [
            {
              text: "Skip today",
              onPress: () => skipForSession(garment.id),
            },
            {
              text: "Skip this week",
              onPress: () => skipForWeek(garment.id),
            },
          ]
        : [
            {
              text: "Remove skip",
              onPress: () => markClean(garment.id), // restore clean state clears skipUntil
            },
          ]),
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
        <Text style={[styles.title, { color: colors.foreground }]}>My Closet</Text>
        <Pressable
          testID="add-garment-button"
          onPress={() => router.push("/(garment)/add")}
        >
          <LinearGradient
            colors={brandColors.gradientPrimary}
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
            >
              {active ? (
                <LinearGradient
                  colors={brandColors.gradientPrimary}
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
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.muted }]}>
            <Feather name="shopping-bag" size={32} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Your closet is empty
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
                ["clean", "#22C55E", "Clean"],
                ["worn", "#64748B", "Worn"],
                ["laundry", "#F97316", "In laundry"],
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
  filterPillActive: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  filterLabelActive: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  filterPillInactive: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  filterLabelInactive: { fontSize: 13, fontFamily: "Inter_500Medium" },
  grid: { paddingHorizontal: 12, paddingTop: 4 },
  row: { gap: 10, marginBottom: 10 },
  card: { flex: 1, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  cardImage: { width: "100%", aspectRatio: 0.75 },
  skippedBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  skippedText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
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
  undoText: { fontSize: 14, fontFamily: "Inter_400Regular", flex: 1, marginRight: 12 },
  undoBtn: { fontSize: 14, fontFamily: "Inter_700Bold" },
});
