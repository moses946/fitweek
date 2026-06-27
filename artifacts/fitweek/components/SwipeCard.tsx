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
export const CARD_HEIGHT = CARD_WIDTH * 1.375;
const SWIPE_THRESHOLD = 80;
const OUT_X = SCREEN_WIDTH + 100;

const CATEGORY_LABELS: Record<string, string> = {
  tops: "TOPS",
  bottoms: "BOTTOMS",
  dresses: "DRESSES",
  outerwear: "OUTERWEAR",
  shoes: "SHOES",
  accessories: "ACCESSORIES",
  other: "OTHER",
};

interface SwipeCardProps {
  garment: Garment;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
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
      { rotate: `${interpolate(tx.value, [-SCREEN_WIDTH, 0, SCREEN_WIDTH], [-15, 0, 15])}deg` },
    ],
  }));

  // Green "Adding" overlay — fades in at 20% of threshold
  const addOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [0, SWIPE_THRESHOLD * 0.8], [0, 1], "clamp"),
  }));

  // Grey "Skip" overlay — fades in on left drag
  const skipOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [-SWIPE_THRESHOLD * 0.8, 0], [1, 0], "clamp"),
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
        tx.value = withSpring(0, { mass: 1, stiffness: 280, damping: 28 });
        ty.value = withSpring(0, { mass: 1, stiffness: 280, damping: 28 });
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
      <Animated.View style={[styles.card, { backgroundColor: colors.card }, animatedCard]}>
        {/* Garment image — top 65% */}
        <Image
          source={{ uri: garment.imageUrl }}
          style={styles.image}
          contentFit="cover"
        />

        {/* ADD colour overlay */}
        <Animated.View style={[styles.addOverlay, addOverlayStyle]}>
          <Text style={styles.addLabel}>Adding</Text>
        </Animated.View>

        {/* SKIP colour overlay */}
        <Animated.View style={[styles.skipOverlay, skipOverlayStyle]}>
          <Text style={styles.skipLabel}>Skip</Text>
        </Animated.View>

        {/* Bottom info strip — white, 35% */}
        <View style={styles.info}>
          <Text style={[styles.garmentName, { color: colors.foreground }]} numberOfLines={1}>
            {garment.name}
          </Text>
          <View style={styles.metaRow}>
            <Text style={[styles.categoryTag, { color: colors.mutedForeground }]}>
              {CATEGORY_LABELS[garment.category] ?? garment.category.toUpperCase()}
            </Text>
            {garment.color ? (
              <View style={styles.colourSwatch} />
            ) : null}
          </View>
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
          opacity: 0.65,
          transform: [{ scale }, { translateY }],
          position: "absolute",
        },
      ]}
    >
      <Image
        source={{ uri: garment.imageUrl }}
        style={styles.image}
        contentFit="cover"
      />
      <View style={styles.info} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E4E0F5",
    shadowColor: "rgba(139, 47, 245, 0.14)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 40,
    elevation: 8,
  },
  image: {
    flex: 65,
  },
  addOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    justifyContent: "flex-start",
    paddingTop: 40,
    paddingLeft: 24,
  },
  addLabel: {
    color: "#10B981",
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    letterSpacing: 0.5,
  },
  skipOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(100, 116, 139, 0.10)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 40,
    paddingRight: 24,
  },
  skipLabel: {
    color: "#64748B",
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    letterSpacing: 0.5,
  },
  info: {
    flex: 35,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
    gap: 4,
  },
  garmentName: {
    fontSize: 20,
    fontFamily: "Poppins_700Bold",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryTag: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    letterSpacing: 0.5,
  },
  colourSwatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#E4E0F5",
  },
});
