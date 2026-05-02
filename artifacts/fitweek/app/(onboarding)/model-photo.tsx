import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
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
  const { pickModelPhoto, completeOnboarding } = useAuth();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handlePickPhoto = async () => {
    try {
      const uri = await pickModelPhoto();
      if (uri) setPhotoUri(uri);
    } catch {
      Alert.alert("Photo error", "Could not access your photo library. Please check permissions.");
    }
  };

  const handleContinue = async () => {
    setIsSaving(true);
    try {
      await completeOnboarding(photoUri);
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = async () => {
    await completeOnboarding(null);
  };

  const TIPS = [
    { icon: "maximize" as const, text: "Full body — head to toe visible" },
    { icon: "sun" as const, text: "Good lighting, plain background" },
    { icon: "user-check" as const, text: "Stand naturally, arms by your sides" },
  ];

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
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Your model photo</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Used to generate virtual try-on previews. Take a full-body photo against a plain wall.
        </Text>
      </View>

      <View style={styles.photoArea}>
        {photoUri ? (
          <Pressable onPress={handlePickPhoto} style={styles.photoPreviewWrapper}>
            <Image source={{ uri: photoUri }} style={styles.photoPreview} contentFit="cover" />
            <View style={[styles.retakeOverlay, { backgroundColor: "#0F172ACC" }]}>
              <Feather name="refresh-cw" size={20} color="#FFFFFF" />
              <Text style={styles.retakeText}>Retake</Text>
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
            <Feather name="user" size={48} color={colors.muted} />
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
          disabled={false}
          label={photoUri ? "Continue" : "Continue without photo"}
        />

        {photoUri && (
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
  header: { paddingHorizontal: 24, gap: 8, marginBottom: 24 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
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
  addPhotoText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
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
  retakeText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  tips: { paddingHorizontal: 24, paddingVertical: 20, gap: 10 },
  tipRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  tipText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  actions: { paddingHorizontal: 24, gap: 14, alignItems: "center" },
  skipText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
