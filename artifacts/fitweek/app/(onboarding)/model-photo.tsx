import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GradientButton } from "@/components/GradientButton";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function ModelPhotoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isUpdateMode = mode === "update";

  const { pickModelPhoto, completeOnboarding, modelImageUrl } = useAuth();
  const [photoUri, setPhotoUri] = useState<string | null>(
    isUpdateMode ? (modelImageUrl ?? null) : null,
  );
  const [isSaving, setIsSaving] = useState(false);

  const handlePickPhoto = async () => {
    try {
      const uri = await pickModelPhoto();
      if (uri) setPhotoUri(uri);
    } catch {
      Alert.alert(
        "Photo error",
        "Could not access your photo library. Please check permissions.",
      );
    }
  };

  const handleContinue = async () => {
    setIsSaving(true);
    try {
      await completeOnboarding(photoUri);
      if (isUpdateMode) {
        router.back();
      } else {
        router.replace("/(tabs)");
      }
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
      setIsSaving(false);
    }
  };

  const handleSkip = async () => {
    await completeOnboarding(null);
    router.replace("/(tabs)");
  };

  const TIPS = [
    { icon: "maximize" as const, text: "Full body — head to toe visible" },
    { icon: "sun" as const, text: "Good lighting, plain background" },
    { icon: "user-check" as const, text: "Stand naturally, arms by your sides" },
  ];

  const title = isUpdateMode ? "Update model photo" : "Your model photo";
  const subtitle = isUpdateMode
    ? "Replace your current photo. Used to generate virtual try-on previews."
    : "Used to generate virtual try-on previews. Take a full-body photo against a plain wall.";

  const continueLabel = isUpdateMode
    ? photoUri === modelImageUrl
      ? "No changes"
      : "Save changes"
    : photoUri
      ? "Continue"
      : "Continue without photo";

  const continueDisabled = isUpdateMode && photoUri === modelImageUrl;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: Platform.OS === "web" ? 67 : insets.top + 16,
          paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 24,
        },
      ]}
    >
      {isUpdateMode && (
        <View style={styles.navBar}>
          <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
        </View>
      )}

      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {subtitle}
        </Text>
      </View>

      <View style={styles.photoArea}>
        {photoUri ? (
          <Pressable onPress={handlePickPhoto} style={styles.photoPreviewWrapper}>
            <Image source={{ uri: photoUri }} style={styles.photoPreview} contentFit="cover" />
            <View style={[styles.retakeOverlay, { backgroundColor: "#0F172ACC" }]}>
              <Feather name="refresh-cw" size={20} color="#FFFFFF" />
              <Text style={styles.retakeText}>
                {isUpdateMode ? "Change photo" : "Retake"}
              </Text>
            </View>
          </Pressable>
        ) : (
          <Pressable
            style={[
              styles.photoPlaceholder,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={handlePickPhoto}
            testID="pick-photo-button"
          >
            <Feather name="user" size={48} color={colors.border} />
            <Pressable
              style={[styles.addPhotoButton, { backgroundColor: colors.primary }]}
              onPress={handlePickPhoto}
            >
              <Feather name="camera" size={16} color="#FFFFFF" />
              <Text style={styles.addPhotoText}>Choose photo</Text>
            </Pressable>
          </Pressable>
        )}
      </View>

      <View style={styles.tips}>
        {TIPS.map((tip) => (
          <View key={tip.text} style={styles.tipRow}>
            <Feather name={tip.icon} size={14} color={colors.accent} />
            <Text style={[styles.tipText, { color: colors.mutedForeground }]}>{tip.text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <GradientButton
          testID="continue-button"
          onPress={handleContinue}
          isLoading={isSaving}
          disabled={continueDisabled}
          label={continueLabel}
        />

        {!isUpdateMode && photoUri && (
          <Pressable onPress={handleSkip} testID="skip-button">
            <Text style={[styles.skipText, { color: colors.mutedForeground }]}>
              Skip for now
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  header: { paddingHorizontal: 24, gap: 8, marginBottom: 24 },
  title: { fontSize: 28, fontFamily: "Poppins_700Bold" },
  subtitle: { fontSize: 15, fontFamily: "Poppins_400Regular", lineHeight: 22 },
  photoArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  photoPlaceholder: {
    width: "100%",
    maxWidth: 260,
    aspectRatio: 0.75,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  addPhotoButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  addPhotoText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#FFFFFF" },
  photoPreviewWrapper: {
    width: "100%",
    maxWidth: 260,
    aspectRatio: 0.75,
    borderRadius: 20,
    overflow: "hidden",
  },
  photoPreview: { width: "100%", height: "100%" },
  retakeOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 8,
  },
  retakeText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#FFFFFF" },
  tips: { paddingHorizontal: 24, paddingVertical: 20, gap: 10 },
  tipRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  tipText: { fontSize: 13, fontFamily: "Poppins_400Regular" },
  actions: { paddingHorizontal: 24, gap: 14, alignItems: "center" },
  skipText: { fontSize: 14, fontFamily: "Poppins_400Regular" },
});
