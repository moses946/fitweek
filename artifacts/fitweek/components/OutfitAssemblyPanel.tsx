import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import brandColors from "@/constants/colors";
import { useColors } from "@/hooks/useColors";
import type { Garment, OutfitSlot } from "@/lib/types";

interface OutfitAssemblyPanelProps {
  slot: OutfitSlot | null;
  garments: Garment[];
  onConfirm: () => void;
  onDiscard: () => void;
  onRemoveGarment: (garmentId: string) => void;
}

export function OutfitAssemblyPanel({
  slot,
  garments,
  onConfirm,
  onDiscard,
  onRemoveGarment,
}: OutfitAssemblyPanelProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const assembledGarments = (slot?.garmentIds ?? [])
    .map((id) => garments.find((g) => g.id === id))
    .filter((g): g is Garment => Boolean(g));

  const count = assembledGarments.length;

  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 16),
        },
      ]}
    >
      {/* Drag handle */}
      <View style={styles.handleWrap}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
      </View>

      {/* Header row */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {count === 0
            ? "Swipe right to add pieces"
            : `${count} piece${count !== 1 ? "s" : ""} selected`}
        </Text>
        {count > 0 && (
          <Pressable onPress={onDiscard} hitSlop={10}>
            <Text style={[styles.discardText, { color: colors.mutedForeground }]}>
              Discard
            </Text>
          </Pressable>
        )}
      </View>

      {/* Garment thumbnail row */}
      {count > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbnailRow}
        >
          {assembledGarments.map((g) => (
            <View key={g.id} style={styles.thumbnailWrap}>
              <Image
                source={{ uri: g.imageUrl }}
                style={styles.thumbnail}
                contentFit="cover"
              />
              <Pressable
                style={[styles.removeBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => onRemoveGarment(g.id)}
                hitSlop={4}
              >
                <Feather name="x" size={10} color={colors.foreground} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyThumbnails}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[styles.thumbnailPlaceholder, { borderColor: colors.border }]}
            />
          ))}
        </View>
      )}

      {/* Confirm button */}
      <Pressable
        onPress={count > 0 ? onConfirm : undefined}
        style={{ opacity: count > 0 ? 1 : 0.4, marginTop: 12 }}
        disabled={count === 0}
      >
        <LinearGradient
          colors={brandColors.gradientPrimary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.confirmBtn}
        >
          <Feather name="check" size={16} color="#FFFFFF" />
          <Text style={styles.confirmText}>Confirm outfit</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  handleWrap: {
    alignItems: "center",
    marginBottom: 10,
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
  },
  discardText: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
  },
  thumbnailRow: {
    gap: 10,
    paddingBottom: 4,
  },
  thumbnailWrap: {
    position: "relative",
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 10,
  },
  removeBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyThumbnails: {
    flexDirection: "row",
    gap: 10,
    paddingBottom: 4,
  },
  thumbnailPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: "dashed",
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  confirmText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
  },
});
