import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackCard, CARD_HEIGHT, CARD_WIDTH, SwipeCard } from "@/components/SwipeCard";
import brandColors from "@/constants/colors";
import { useGarments } from "@/contexts/GarmentContext";
import { useOutfitSlots } from "@/contexts/OutfitSlotContext";
import { useWeather } from "@/contexts/WeatherContext";
import { useColors } from "@/hooks/useColors";
import { interleaveByCategory } from "@/lib/suggestionFilter";
import type { Garment } from "@/lib/types";
import { API_BASE_URL } from "@/lib/config";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const LOW_DECK_THRESHOLD = 3;
const MIN_LIKED = 3;

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getWeekDays(): Date[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function getProxyBase(): string {
  if (Platform.OS === "web") return "";
  return API_BASE_URL;
}

export default function PlanWeekScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();

  const { garments } = useGarments();
  const { slots, bulkWriteDrafts } = useOutfitSlots();
  const { forecast } = useWeather();

  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [liveDeck, setLiveDeck] = useState<Garment[]>([]);
  const [sessionPool, setSessionPool] = useState<Garment[]>([]);
  const [curating, setCurating] = useState(false);

  const liveDeckRef = useRef(liveDeck);
  const sessionPoolRef = useRef(sessionPool);
  liveDeckRef.current = liveDeck;
  sessionPoolRef.current = sessionPool;

  useEffect(() => {
    const clean = garments.filter((g) => g.status === "active" && !g.deletedAt);
    setLiveDeck(interleaveByCategory(clean));
  }, []);

  useEffect(() => {
    if (liveDeck.length <= LOW_DECK_THRESHOLD && sessionPool.length > 0) {
      setLiveDeck((prev) => [...prev, ...sessionPool]);
      setSessionPool([]);
    }
  }, [liveDeck.length, sessionPool.length]);

  const advanceDeck = useCallback((wasSkipped: boolean, garment: Garment) => {
    const newPool = wasSkipped
      ? [...sessionPoolRef.current, garment]
      : sessionPoolRef.current;
    setSessionPool(newPool);
    setLiveDeck((prev) => {
      const next = prev.slice(1);
      if (next.length <= LOW_DECK_THRESHOLD && newPool.length > 0) {
        setSessionPool([]);
        return [...next, ...newPool];
      }
      return next;
    });
  }, []);

  const handleSwipeRight = useCallback((garment: Garment) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLikedIds((prev) => new Set([...prev, garment.id]));
    advanceDeck(false, garment);
  }, [advanceDeck]);

  const handleSwipeLeft = useCallback((garment: Garment) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    advanceDeck(true, garment);
  }, [advanceDeck]);

  const handleCurateWeek = useCallback(async () => {
    const likedList = garments.filter((g) => likedIds.has(g.id));
    const poolForSuggest = likedList.length >= MIN_LIKED
      ? likedList
      : garments.filter((g) => g.status === "active" && !g.deletedAt);

    if (!poolForSuggest.length) {
      Alert.alert("No garments", "Add some clean garments to your wardrobe first.");
      return;
    }

    const weekDates = getWeekDays()
      .map(toISODate)
      .filter((d) => {
        const s = slots.find((sl) => sl.date === d);
        return !s || s.status !== "confirmed";
      });

    if (!weekDates.length) {
      Alert.alert("All set!", "You already have confirmed outfits for every day this week.");
      router.back();
      return;
    }

    setCurating(true);
    try {
      const res = await fetch(`${getProxyBase()}/api/outfit/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dates: weekDates,
          garments: poolForSuggest,
          forecasts: forecast ?? [],
        }),
      });
      if (!res.ok) throw new Error("Suggest failed");
      const { suggestions } = (await res.json()) as { suggestions: Record<string, string[]> };

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await bulkWriteDrafts(suggestions);

      router.back();
    } catch {
      Alert.alert("Curating failed", "Could not build your week. Please try again.");
    } finally {
      setCurating(false);
    }
  }, [garments, likedIds, slots, forecast, bulkWriteDrafts, router]);

  const likedCount = likedIds.size;
  const deckExhausted = liveDeck.length === 0;
  const canCurate = likedCount >= MIN_LIKED || deckExhausted;
  const currentCard = liveDeck[0];
  const likedGarments = garments.filter((g) => likedIds.has(g.id));

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
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="x" size={22} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Pick Your Favourites
          </Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            Swipe right on pieces you'd love this week
          </Text>
        </View>
        <View style={styles.likedBadge}>
          <LinearGradient
            colors={brandColors.gradientPrimary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.likedBadgeGradient}
          >
            <Text style={styles.likedBadgeText}>{likedCount}</Text>
          </LinearGradient>
          <Text style={[styles.likedBadgeLabel, { color: colors.mutedForeground }]}>liked</Text>
        </View>
      </View>

      {/* Hint row */}
      <View style={styles.hintRow}>
        <Text style={[styles.hintText, { color: colors.statusWorn ?? "#64748B" }]}>← Skip</Text>
        <Text style={[styles.hintSub, { color: colors.mutedForeground }]}>
          {likedCount > 0
            ? `${likedCount} piece${likedCount !== 1 ? "s" : ""} liked`
            : "Swipe right to like"}
        </Text>
        <Text style={[styles.hintText, { color: "#10B981" }]}>Like →</Text>
      </View>

      {/* Card deck */}
      <View style={styles.deckArea}>
        {deckExhausted ? (
          <View style={styles.emptyDeck}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.muted }]}>
              <Feather name="check-circle" size={40} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              You've seen everything
            </Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              {likedCount > 0
                ? `${likedCount} piece${likedCount !== 1 ? "s" : ""} ready — tap Curate My Week below.`
                : "No pieces liked — we'll use your full wardrobe."}
            </Text>
          </View>
        ) : (
          <View style={styles.stack}>
            {liveDeck[2] && (
              <BackCard garment={liveDeck[2]} scale={0.90} translateY={20} />
            )}
            {liveDeck[1] && (
              <BackCard garment={liveDeck[1]} scale={0.94} translateY={10} />
            )}
            {currentCard && (
              <SwipeCard
                key={currentCard.id}
                garment={currentCard}
                onSwipeRight={() => handleSwipeRight(currentCard)}
                onSwipeLeft={() => handleSwipeLeft(currentCard)}
              />
            )}
          </View>
        )}
      </View>

      {/* Liked garment strip */}
      {likedGarments.length > 0 && (
        <View style={styles.likedStrip}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.likedStripInner}
          >
            {likedGarments.map((g) => (
              <Image
                key={g.id}
                source={{ uri: g.imageUrl }}
                style={[styles.likedThumb, { borderColor: colors.primary }]}
                contentFit="cover"
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Bottom actions */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        {canCurate ? (
          <Pressable
            onPress={handleCurateWeek}
            disabled={curating}
            style={({ pressed }) => [styles.curateBtn, { opacity: pressed || curating ? 0.8 : 1 }]}
          >
            <LinearGradient
              colors={brandColors.gradientPrimary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.curateBtnGradient}
            >
              {curating ? (
                <>
                  <ActivityIndicator size="small" color="#FFF" />
                  <Text style={styles.curateBtnLabel}>Building your week…</Text>
                </>
              ) : (
                <>
                  <Feather name="zap" size={16} color="#FFF" />
                  <Text style={styles.curateBtnLabel}>Curate My Week</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        ) : (
          <View style={styles.curateHint}>
            <Text style={[styles.curateHintText, { color: colors.mutedForeground }]}>
              Like {MIN_LIKED - likedCount} more piece{MIN_LIKED - likedCount !== 1 ? "s" : ""} to curate your week
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  headerCenter: { flex: 1, gap: 2 },
  headerTitle: { fontSize: 16, fontFamily: "Poppins_600SemiBold" },
  headerSub: { fontSize: 12, fontFamily: "Poppins_400Regular" },
  likedBadge: { alignItems: "center", gap: 2 },
  likedBadgeGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  likedBadgeText: {
    color: "#FFF",
    fontSize: 16,
    fontFamily: "Poppins_700Bold",
  },
  likedBadgeLabel: { fontSize: 10, fontFamily: "Poppins_400Regular" },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 28,
    paddingBottom: 10,
  },
  hintText: { fontSize: 13, fontFamily: "Poppins_600SemiBold" },
  hintSub: { fontSize: 11, fontFamily: "Poppins_400Regular" },
  deckArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stack: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT + 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyDeck: {
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 14,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 20, fontFamily: "Poppins_700Bold", textAlign: "center" },
  emptyBody: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  likedStrip: {
    height: 64,
    borderTopWidth: 1,
    borderTopColor: "#E4E0F5",
  },
  likedStripInner: {
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 8,
  },
  likedThumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
    borderWidth: 2,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E4E0F5",
  },
  curateBtn: { borderRadius: 16, overflow: "hidden" },
  curateBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  curateBtnLabel: {
    color: "#FFF",
    fontSize: 15,
    fontFamily: "Poppins_600SemiBold",
  },
  curateHint: {
    alignItems: "center",
    paddingVertical: 16,
  },
  curateHintText: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    textAlign: "center",
  },
});
