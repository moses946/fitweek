import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GarmentCategory, useGarments } from "@/contexts/GarmentContext";
import { useColors } from "@/hooks/useColors";

// --- Config ---

const CATEGORIES: GarmentCategory[] = [
  "tops",
  "bottoms",
  "dresses",
  "outerwear",
  "shoes",
  "accessories",
  "other",
];

const CATEGORY_LABELS: Record<GarmentCategory, string> = {
  tops: "Tops",
  bottoms: "Bottoms",
  dresses: "Dresses",
  outerwear: "Outerwear",
  shoes: "Shoes",
  accessories: "Accessories",
  other: "Other",
};

const COLOR_HEX: Record<string, string> = {
  White: "#F5F5F0",
  Black: "#1A1A1A",
  Gray: "#808080",
  "Light Gray": "#C8C8C8",
  Charcoal: "#36454F",
  Red: "#C0392B",
  Burgundy: "#7B1830",
  Orange: "#E67E22",
  Yellow: "#F1C40F",
  Khaki: "#C3B091",
  Olive: "#6B6B00",
  Green: "#27AE60",
  "Forest Green": "#1A6B3A",
  Teal: "#16A085",
  Cyan: "#00BCD4",
  Navy: "#0D1B4B",
  Blue: "#2980B9",
  "Light Blue": "#85C1E9",
  Purple: "#7D3C98",
  Pink: "#F48FB1",
  Magenta: "#AB47BC",
  Brown: "#795548",
  Beige: "#D7CCC8",
  Unknown: "#BDBDBD",
};

type Step = "pick" | "analyzing" | "review";

export default function AddGarmentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addGarment, classifyImage } = useGarments();

  const [step, setStep] = useState<Step>("pick");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [category, setCategory] = useState<GarmentCategory>("tops");
  const [color, setColor] = useState("Unknown");
  const [tags, setTags] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handlePickPhoto = async (useCamera: boolean) => {
    try {
      let result: ImagePicker.ImagePickerResult;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission required", "Camera access is needed to photograph garments.");
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [3, 4],
          quality: 0.8,
          base64: true,
        });
      } else {
        await ImagePicker.requestMediaLibraryPermissionsAsync();
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: "images",
          allowsEditing: true,
          aspect: [3, 4],
          quality: 0.8,
          base64: true,
        });
      }

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      setImageUri(asset.uri);
      setStep("analyzing");

      // Call Vision API
      const classified = await classifyImage({
        imageBase64: asset.base64 ?? undefined,
      });

      if (classified) {
        setCategory(classified.category);
        setColor(classified.color);
        setTags(classified.tags);
      }

      setStep("review");
    } catch {
      Alert.alert("Error", "Could not open the photo picker. Please try again.");
      setStep("pick");
    }
  };

  const handleSave = async () => {
    if (!imageUri) return;
    setIsSaving(true);
    try {
      await addGarment({
        imageUri,
        category,
        color,
        tags,
        name: name.trim() || CATEGORY_LABELS[category],
        status: "clean",
      });
      router.back();
    } catch {
      Alert.alert("Error", "Could not save the garment. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const removeTag = (tag: string) => setTags((prev) => prev.filter((t) => t !== tag));

  const pb = Platform.OS === "web" ? 34 : insets.bottom + 16;
  const pt = Platform.OS === "web" ? 67 : insets.top + 12;

  // --- Step: Pick ---
  if (step === "pick") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: pt, paddingBottom: pb }]}>
        <View style={styles.sheetHandle}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>

        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Feather name="x" size={22} color={colors.mutedForeground} />
        </Pressable>

        <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Add garment</Text>
        <Text style={[styles.sheetSubtitle, { color: colors.mutedForeground }]}>
          Take a photo or choose from your library
        </Text>

        <View style={styles.pickOptions}>
          <Pressable
            style={({ pressed }) => [
              styles.pickOption,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => handlePickPhoto(true)}
          >
            <View style={[styles.pickIconWrap, { backgroundColor: colors.primary }]}>
              <Feather name="camera" size={24} color={colors.primaryForeground} />
            </View>
            <Text style={[styles.pickOptionLabel, { color: colors.foreground }]}>Camera</Text>
            <Text style={[styles.pickOptionSub, { color: colors.mutedForeground }]}>Take a new photo</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.pickOption,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => handlePickPhoto(false)}
          >
            <View style={[styles.pickIconWrap, { backgroundColor: colors.accent }]}>
              <Feather name="image" size={24} color={colors.primaryForeground} />
            </View>
            <Text style={[styles.pickOptionLabel, { color: colors.foreground }]}>Library</Text>
            <Text style={[styles.pickOptionSub, { color: colors.mutedForeground }]}>Choose existing photo</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // --- Step: Analyzing ---
  if (step === "analyzing") {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        {imageUri && (
          <Image source={{ uri: imageUri }} style={styles.analyzingPreview} contentFit="cover" />
        )}
        <View style={[styles.analyzingOverlay, { backgroundColor: colors.background + "E8" }]}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.analyzingText, { color: colors.foreground }]}>Analyzing garment…</Text>
          <Text style={[styles.analyzingSubtext, { color: colors.mutedForeground }]}>
            Google Vision is classifying your item
          </Text>
        </View>
      </View>
    );
  }

  // --- Step: Review ---
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.reviewHeader, { paddingTop: pt, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => setStep("pick")}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.reviewTitle, { color: colors.foreground }]}>Review</Text>
        <Pressable onPress={() => router.back()}>
          <Feather name="x" size={22} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.reviewContent, { paddingBottom: pb + 80 }]}>
        {/* Photo preview */}
        {imageUri && (
          <Image source={{ uri: imageUri }} style={styles.reviewImage} contentFit="cover" />
        )}

        {/* Color detected */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>COLOR</Text>
          <View style={styles.colorRow}>
            <View style={[styles.colorDot, { backgroundColor: COLOR_HEX[color] ?? "#CCC", borderColor: colors.border }]} />
            <Text style={[styles.colorName, { color: colors.foreground }]}>{color}</Text>
          </View>
        </View>

        {/* Category */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>CATEGORY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                style={[
                  styles.pill,
                  {
                    backgroundColor: category === cat ? colors.primary : colors.card,
                    borderColor: category === cat ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setCategory(cat)}
              >
                <Text
                  style={[
                    styles.pillText,
                    { color: category === cat ? colors.primaryForeground : colors.mutedForeground },
                  ]}
                >
                  {CATEGORY_LABELS[cat]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Tags */}
        {tags.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>TAGS</Text>
            <View style={styles.tagsWrap}>
              {tags.map((tag) => (
                <Pressable
                  key={tag}
                  style={[styles.tagChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                  onPress={() => removeTag(tag)}
                >
                  <Text style={[styles.tagText, { color: colors.foreground }]}>{tag}</Text>
                  <Feather name="x" size={12} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Optional name */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>NAME (OPTIONAL)</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={CATEGORY_LABELS[category]}
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.nameInput,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
            ]}
          />
        </View>
      </ScrollView>

      {/* Save button */}
      <View
        style={[
          styles.saveBar,
          { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: pb },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.saveText, { color: colors.primaryForeground }]}>Save to closet</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center" },
  sheetHandle: { alignItems: "center", paddingBottom: 8 },
  handle: { width: 36, height: 4, borderRadius: 2 },
  closeBtn: {
    position: "absolute",
    top: 60,
    right: 20,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  sheetSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 24,
    marginTop: 6,
    marginBottom: 32,
  },
  pickOptions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 14,
  },
  pickOption: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    gap: 12,
  },
  pickIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  pickOptionLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  pickOptionSub: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  analyzingPreview: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  analyzingOverlay: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 40,
    paddingVertical: 32,
    borderRadius: 20,
  },
  analyzingText: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  analyzingSubtext: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reviewTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  reviewContent: { paddingHorizontal: 20, paddingTop: 20, gap: 24 },
  reviewImage: {
    width: "100%",
    aspectRatio: 0.75,
    borderRadius: 16,
  },
  section: { gap: 10 },
  label: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  colorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  colorDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1 },
  colorName: { fontSize: 15, fontFamily: "Inter_500Medium" },
  pillRow: { flexDirection: "row" },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  pillText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  tagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  tagText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  nameInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  saveBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveButton: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
