import { Image } from "expo-image";
import React from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { useColors } from "@/hooks/useColors";
import type { Garment } from "@/lib/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
export const CARD_WIDTH = SCREEN_WIDTH - 40;
export const CARD_HEIGHT = CARD_WIDTH * 1.35;
const SWIPE_THRESHOLD = 80;
const OUT_X = SCREEN_WIDTH + 100;

const CATEGORY_LABELS: Record<string, string> = {
  tops: "Top",
  bottoms: "Trousers",
  dresses: "Dress",
  outerwear: "Jacket",
  shoes: "Shoes",
  accessories: "Accessories",
  other: "Other",
};

interface SwipeCardProps {
  garment: Garment;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  /** Called with a long press — used to trigger "skip for week" */
  onLongPress?: () => void;
}

export function SwipeCard({
  garment,
  onSwipeRight,
  onSwipeLeft,
  onLongPress,
}: SwipeCardProps) {
  const colors = useColors();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  const animatedCard = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${interpolate(tx.value, [-SCREEN_WIDTH, 0, SCREEN_WIDTH], [-25, 0, 25])}deg` },
    ],
  }));

  const addLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [0, SWIPE_THRESHOLD], [0, 1], "clamp"),
  }));

  const skipLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [-SWIPE_THRESHOLD, 0], [1, 0], "clamp"),
  }));

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY * 0.3;
    })
    .onEnd((e) => {
      if (e.translationX > SWIPE_THRESHOLD) {
        tx.value = withTiming(OUT_X, { duration: 220 }, () =>
          runOnJS(onSwipeRight)(),
        );
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        tx.value = withTiming(-OUT_X, { duration: 220 }, () =>
          runOnJS(onSwipeLeft)(),
        );
      } else {
        tx.value = withSpring(0, { damping: 15 });
        ty.value = withSpring(0, { damping: 15 });
      }
    });

  const longPress = Gesture.LongPress()
    .minDuration(500)
    .onStart(() => {
      if (onLongPress) runOnJS(onLongPress)();
    });

  const gesture = Gesture.Simultaneous(pan, longPress);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.card,
          { backgroundColor: colors.card, shadowColor: colors.foreground },
          animatedCard,
        ]}
      >
        {/* Garment image */}
        <Image
          source={{ uri: garment.imageUri }}
          style={styles.image}
          contentFit="cover"
        />

        {/* ADD label overlay */}
        <Animated.View style={[styles.labelAdd, addLabelStyle]}>
          <Text style={styles.labelAddText}>ADD ✓</Text>
        </Animated.View>

        {/* SKIP label overlay */}
        <Animated.View style={[styles.labelSkip, skipLabelStyle]}>
          <Text style={styles.labelSkipText}>SKIP ✗</Text>
        </Animated.View>

        {/* Bottom info strip */}
        <View style={styles.info}>
          <View
            style={[styles.categoryBadge, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.categoryText}>
              {CATEGORY_LABELS[garment.category] ?? garment.category}
            </Text>
          </View>
          <Text style={[styles.colorText, { color: colors.foreground }]}>
            {garment.color}
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

/** Non-interactive back card shown behind the top card */
export function BackCard({
  garment,
  scale,
  translateY,
}: {
  garment: Garment;
  scale: number;
  translateY: number;
}) {
  const colors = useColors();
  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          shadowColor: colors.foreground,
          transform: [{ scale }, { translateY }],
          position: "absolute",
        },
      ]}
    >
      <Image
        source={{ uri: garment.imageUri }}
        style={styles.image}
        contentFit="cover"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  image: {
    flex: 1,
  },
  labelAdd: {
    position: "absolute",
    top: 36,
    left: 24,
    borderWidth: 3,
    borderColor: "#22C55E",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    transform: [{ rotate: "-15deg" }],
  },
  labelAddText: {
    color: "#22C55E",
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  labelSkip: {
    position: "absolute",
    top: 36,
    right: 24,
    borderWidth: 3,
    borderColor: "#EF4444",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    transform: [{ rotate: "15deg" }],
  },
  labelSkipText: {
    color: "#EF4444",
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  info: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  categoryBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  colorText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
});
