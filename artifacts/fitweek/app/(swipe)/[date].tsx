import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OutfitAssemblyPanel } from "@/components/OutfitAssemblyPanel";
import { BackCard, CARD_HEIGHT, CARD_WIDTH, SwipeCard } from "@/components/SwipeCard";
import { WeatherBadge, WeatherUnavailableBadge } from "@/components/WeatherBadge";
import { useGarments } from "@/contexts/GarmentContext";
import { useOutfitSlots } from "@/contexts/OutfitSlotContext";
import { useWeather } from "@/contexts/WeatherContext";
import { useColors } from "@/hooks/useColors";
import { buildSuggestionDeck } from "@/lib/suggestionFilter";
import type { Garment, OutfitSlot } from "@/lib/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const LOW_DECK_THRESHOLD = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateLabel(isoDate: string): string {
  try {
    const [y, m, d] = isoDate.split("-").map(Number);
    const date = new Date(y!, m! - 1, d!);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}

// ── Empty deck state ──────────────────────────────────────────────────────────

function EmptyDeck({ onClose }: { onClose: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.emptyDeck}>
      <View style={[styles.emptyIconWrap, { backgroundColor: colors.muted }]}>
        <Feather name="check-circle" size={40} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        You've seen everything
      </Text>
      <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
        All eligible garments have been reviewed. Confirm your outfit or add
        more garments to your closet.
      </Text>
      <Pressable
        style={[styles.closeBtn, { borderColor: colors.border }]}
        onPress={onClose}
      >
        <Text style={[styles.closeBtnText, { color: colors.foreground }]}>
          Done
        </Text>
      </Pressable>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SwipeDeckScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();

  const { garments, skipForSession, skipForWeek } = useGarments();
  const {
    slots,
    getOrCreateDraft,
    addGarmentToSlot,
    removeGarmentFromSlot,
    confirmSlot,
    clearSlot,
  } = useOutfitSlots();
  const { forecast } = useWeather();

  const [slot, setSlot] = useState<OutfitSlot | null>(null);
  const [liveDeck, setLiveDeck] = useState<Garment[]>([]);
  const [sessionPool, setSessionPool] = useState<Garment[]>([]);
  const [isConfirming, setIsConfirming] = useState(false);

  // Stable ref so callbacks inside gestures capture latest state
  const liveDeckRef = useRef(liveDeck);
  const sessionPoolRef = useRef(sessionPool);
  liveDeckRef.current = liveDeck;
  sessionPoolRef.current = sessionPool;

  // ── Initialise slot + deck ──────────────────────────────────────────────────
  useEffect(() => {
    if (!date) return;

    getOrCreateDraft(date).then((s) => {
      setSlot(s);

      // Build the suggestion deck for this date
      const confirmedIds = new Set(
        slots
          .filter((sl) => sl.status === "confirmed" && sl.date !== date)
          .flatMap((sl) => sl.garmentIds),
      );
      const eligible = garments.filter((g) => !confirmedIds.has(g.id));
      const todayForecast = forecast?.find((f) => f.date === date) ?? null;
      const dateObj = (() => {
        const [y, m, d] = date.split("-").map(Number);
        return new Date(y!, m! - 1, d!);
      })();

      setLiveDeck(buildSuggestionDeck(eligible, todayForecast, dateObj));
    });
  }, [date]);

  // ── Live deck sync with slot (when garment added externally) ───────────────
  // Keep slot in sync with the latest context state
  useEffect(() => {
    if (!slot) return;
    const updated = slots.find((s) => s.id === slot.id);
    if (updated) setSlot(updated);
  }, [slots]);

  // ── Low-deck reintroduction ─────────────────────────────────────────────────
  useEffect(() => {
    if (liveDeck.length <= LOW_DECK_THRESHOLD && sessionPool.length > 0) {
      setLiveDeck((prev) => [...prev, ...sessionPool]);
      setSessionPool([]);
    }
  }, [liveDeck.length, sessionPool.length]);

  // ── Swipe handlers ──────────────────────────────────────────────────────────

  const advanceDeck = useCallback(
    (wasSkipped: boolean, garment: Garment) => {
      const newPool = wasSkipped
        ? [...sessionPoolRef.current, garment]
        : sessionPoolRef.current;
      setSessionPool(newPool);
      setLiveDeck((prev) => {
        const next = prev.slice(1);
        // Inline reintroduction if low
        if (next.length <= LOW_DECK_THRESHOLD && newPool.length > 0) {
          setSessionPool([]);
          return [...next, ...newPool];
        }
        return next;
      });
    },
    [],
  );

  const handleSwipeRight = useCallback(
    async (garment: Garment) => {
      if (!slot) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await addGarmentToSlot(slot.id, garment.id);
      advanceDeck(false, garment);
    },
    [slot, addGarmentToSlot, advanceDeck],
  );

  const handleSwipeLeft = useCallback(
    async (garment: Garment) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await skipForSession(garment.id);
      advanceDeck(true, garment);
    },
    [skipForSession, advanceDeck],
  );

  const handleLongPress = useCallback(
    (garment: Garment) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert(
        "Skip for the week?",
        `"${garment.name}" won't appear in suggestions until next week.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Skip for week",
            style: "destructive",
            onPress: async () => {
              await skipForWeek(garment.id);
              advanceDeck(false, garment);
            },
          },
        ],
      );
    },
    [skipForWeek, advanceDeck],
  );

  // ── Confirm / discard ───────────────────────────────────────────────────────

  const handleConfirm = useCallback(async () => {
    if (!slot) return;
    setIsConfirming(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await confirmSlot(slot.id);
      router.back();
    } finally {
      setIsConfirming(false);
    }
  }, [slot, confirmSlot, router]);

  const handleDiscard = useCallback(async () => {
    if (!slot) return;
    Alert.alert(
      "Discard outfit?",
      "All selected pieces will be removed and the slot cleared.",
      [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: async () => {
            await clearSlot(slot.id);
            router.back();
          },
        },
      ],
    );
  }, [slot, clearSlot, router]);

  const handleRemoveGarment = useCallback(
    async (garmentId: string) => {
      if (!slot) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await removeGarmentFromSlot(slot.id, garmentId);
    },
    [slot, removeGarmentFromSlot],
  );

  // ── Current forecast for this day ─────────────────────────────────────────
  const todayForecast = forecast?.find((f) => f.date === date) ?? null;
  const currentCard = liveDeck[0];

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
          <Text style={[styles.headerDate, { color: colors.foreground }]}>
            {date ? formatDateLabel(date) : ""}
          </Text>
          <View style={styles.headerWeather}>
            {todayForecast ? (
              <WeatherBadge forecast={todayForecast} size="compact" />
            ) : (
              <WeatherUnavailableBadge />
            )}
          </View>
        </View>

        {/* Deck counter */}
        <Text style={[styles.deckCount, { color: colors.mutedForeground }]}>
          {liveDeck.length} left
        </Text>
      </View>

      {/* Hint */}
      <View style={styles.hintRow}>
        <Text style={[styles.hintText, { color: "#EF4444" }]}>← Skip</Text>
        <Text style={[styles.hintSub, { color: colors.mutedForeground }]}>
          Long-press to skip for week
        </Text>
        <Text style={[styles.hintText, { color: "#22C55E" }]}>Add →</Text>
      </View>

      {/* Card stack */}
      <View style={styles.deckArea}>
        {liveDeck.length === 0 ? (
          <EmptyDeck onClose={() => router.back()} />
        ) : (
          <View style={styles.stack}>
            {/* Back cards (non-interactive, rendered bottom-up) */}
            {liveDeck[2] && (
              <BackCard
                garment={liveDeck[2]}
                scale={0.90}
                translateY={20}
              />
            )}
            {liveDeck[1] && (
              <BackCard
                garment={liveDeck[1]}
                scale={0.95}
                translateY={10}
              />
            )}
            {/* Top card */}
            {currentCard && (
              <SwipeCard
                key={currentCard.id}
                garment={currentCard}
                onSwipeRight={() => handleSwipeRight(currentCard)}
                onSwipeLeft={() => handleSwipeLeft(currentCard)}
                onLongPress={() => handleLongPress(currentCard)}
              />
            )}
          </View>
        )}
      </View>

      {/* Outfit assembly panel */}
      <OutfitAssemblyPanel
        slot={slot}
        garments={garments}
        onConfirm={handleConfirm}
        onDiscard={handleDiscard}
        onRemoveGarment={handleRemoveGarment}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  headerCenter: { flex: 1, alignItems: "center", gap: 4 },
  headerDate: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  headerWeather: { flexDirection: "row", alignItems: "center" },
  deckCount: { fontSize: 13, fontFamily: "Inter_400Regular", minWidth: 48, textAlign: "right" },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 28,
    paddingBottom: 12,
  },
  hintText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  hintSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
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
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptyBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  closeBtn: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  closeBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
