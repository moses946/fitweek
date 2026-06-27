import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
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

import { GradientButton } from "@/components/GradientButton";
import brandColors from "@/constants/colors";
import { GarmentCategory, useGarments } from "@/contexts/GarmentContext";
import { useColors } from "@/hooks/useColors";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const CATEGORIES: GarmentCategory[] = [
  "tops", "bottoms", "dresses", "outerwear", "shoes", "accessories", "other",
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
  White: "#F8FAFC",
  Black: "#0F172A",
  Gray: "#64748B",
  "Light Gray": "#CBD5E1",
  Charcoal: "#334155",
  Red: "#C0392B",
  Burgundy: "#7B1830",
  Orange: "#EA580C",
  Yellow: "#EAB308",
  Khaki: "#C3B091",
  Olive: "#4D7C0F",
  Green: "#16A34A",
  "Forest Green": "#14532D",
  Teal: "#0D9488",
  Cyan: "#06B6D4",
  Navy: "#1E3A5F",
  Blue: "#2563EB",
  "Light Blue": "#7DD3FC",
  Purple: "#7C3AED",
  Pink: "#EC4899",
  Magenta: "#A21CAF",
  Brown: "#78350F",
  Beige: "#D6D3D1",
  Unknown: "#CBD5E1",
};

type Step = "pick" | "analyzing" | "review";

export default function AddGarmentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addGarment, classifyImage } = useGarments();

  const [step, setStep] = useState<Step>("pick");
  const [imageUri, setImageUri] = useState<string | null>(null);
  /** Set to the bg-removed data URI after classify returns processedImageBase64. */
  const [processedUri, setProcessedUri] = useState<string | null>(null);
  const [analyzingLabel, setAnalyzingLabel] = useState("Removing background…");
  const [category, setCategory] = useState<GarmentCategory>("tops");
  const [color, setColor] = useState("Unknown");
  const [tags, setTags] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const pt = Platform.OS === "web" ? 67 : insets.top + 12;
  const pb = Platform.OS === "web" ? 34 : insets.bottom + 16;

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
      setProcessedUri(null);
      setAnalyzingLabel("Removing background…");
      setStep("analyzing");

      // Phase 1 label is shown until the classify call begins returning
      const classified = await classifyImage({ imageBase64: asset.base64 ?? undefined });

      // Switch label for phase 2 (classify is synchronous from the server's PoV,
      // but the label flip reassures the user that something new is happening)
      setAnalyzingLabel("Classifying garment…");

      if (classified) {
        setCategory(classified.category);
        setColor(classified.color);
        setTags(classified.tags);
        if (classified.matchedLabel) setName(classified.matchedLabel);

        // If the server returned a bg-removed PNG, swap in the clean version
        if (classified.processedImageBase64) {
          setProcessedUri(`data:image/png;base64,${classified.processedImageBase64}`);
        }
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
      // Determine which URI to store — prefer the bg-removed version
      const displayUri = processedUri ?? imageUri;

      // Upload to Supabase Storage — always, so we store a stable HTTPS URL.
      // Prefer the bg-removed PNG when available; fall back to the original image.
      //
      // IMPORTANT: React Native's fetch() returns empty bodies for file:// URIs.
      // The correct Expo pattern is: readAsStringAsync(base64) → decode → ArrayBuffer.
      let finalUri = displayUri;
      if (isSupabaseConfigured) {
        try {
          let base64: string;
          let contentType: string;
          const storagePath = `garments/${Date.now()}_${Math.random().toString(36).slice(2)}`;

          if (processedUri) {
            // bg-removed: processedUri is already a data:image/png;base64,... URI in memory
            base64 = processedUri.replace(/^data:image\/png;base64,/, "");
            contentType = "image/png";
          } else {
            // Original picked image — read from the device file system
            base64 = await FileSystem.readAsStringAsync(imageUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            // Detect type from the URI extension; default to jpeg
            const lower = imageUri.toLowerCase();
            contentType = lower.endsWith(".png") ? "image/png"
              : lower.endsWith(".webp") ? "image/webp"
              : "image/jpeg";
          }

          // Decode base64 → Uint8Array → ArrayBuffer (works everywhere in Expo)
          const binaryStr = atob(base64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }

          const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
          const { error: uploadError } = await supabase.storage
            .from("garments")
            .upload(`${storagePath}.${ext}`, bytes.buffer as ArrayBuffer, {
              contentType,
              upsert: false,
            });

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from("garments")
              .getPublicUrl(`${storagePath}.${ext}`);
            finalUri = urlData.publicUrl;
            console.log("[garment-save] Uploaded to Supabase:", finalUri);
          } else {
            console.warn("[garment-save] Supabase upload failed, using local URI.", uploadError);
          }
        } catch (uploadErr) {
          console.warn("[garment-save] Upload step threw, using local URI.", uploadErr);
        }
      }



      await addGarment({
        imageUrl: finalUri,
        category,
        color,
        tags,
        name: name.trim() || CATEGORY_LABELS[category],
        status: "active",
      });
      router.back();
    } catch {
      Alert.alert("Error", "Could not save the garment. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const removeTag = (tag: string) => setTags((prev) => prev.filter((t) => t !== tag));

  if (step === "pick") {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: pt, paddingBottom: pb },
        ]}
      >
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
            <LinearGradient
              colors={brandColors.gradientPrimary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.pickIconWrap}
            >
              <Feather name="camera" size={24} color="#FFFFFF" />
            </LinearGradient>
            <Text style={[styles.pickOptionLabel, { color: colors.foreground }]}>Camera</Text>
            <Text style={[styles.pickOptionSub, { color: colors.mutedForeground }]}>
              Take a new photo
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.pickOption,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => handlePickPhoto(false)}
          >
            <LinearGradient
              colors={[brandColors.gradientPrimary[1], brandColors.gradientPrimary[0]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.pickIconWrap}
            >
              <Feather name="image" size={24} color="#FFFFFF" />
            </LinearGradient>
            <Text style={[styles.pickOptionLabel, { color: colors.foreground }]}>Library</Text>
            <Text style={[styles.pickOptionSub, { color: colors.mutedForeground }]}>
              Choose existing photo
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (step === "analyzing") {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        {imageUri && (
          <Image source={{ uri: imageUri }} style={styles.analyzingPreview} contentFit="cover" />
        )}
        <View style={[styles.analyzingOverlay, { backgroundColor: colors.card + "F0" }]}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.analyzingText, { color: colors.foreground }]}>
            Analyzing garment…
          </Text>
          <Text style={[styles.analyzingSubtext, { color: colors.mutedForeground }]}>
            {analyzingLabel}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.reviewHeader,
          { paddingTop: pt, borderBottomColor: colors.border },
        ]}
      >
        <Pressable onPress={() => setStep("pick")}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.reviewTitle, { color: colors.foreground }]}>Review</Text>
        <Pressable onPress={() => router.back()}>
          <Feather name="x" size={22} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.reviewContent, { paddingBottom: pb + 80 }]}>
        {(processedUri ?? imageUri) && (
          <Image source={{ uri: processedUri ?? imageUri! }} style={styles.reviewImage} contentFit="contain" />
        )}

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>COLOR</Text>
          <View style={styles.colorRow}>
            <View
              style={[
                styles.colorDot,
                { backgroundColor: COLOR_HEX[color] ?? "#CBD5E1", borderColor: colors.border },
              ]}
            />
            <Text style={[styles.colorName, { color: colors.foreground }]}>{color}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>CATEGORY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
            {CATEGORIES.map((cat) => (
              <Pressable key={cat} onPress={() => setCategory(cat)} style={styles.pillWrapper}>
                {category === cat ? (
                  <LinearGradient
                    colors={brandColors.gradientPrimary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.pillActive}
                  >
                    <Text style={styles.pillTextActive}>{CATEGORY_LABELS[cat]}</Text>
                  </LinearGradient>
                ) : (
                  <View
                    style={[
                      styles.pillInactive,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.pillTextInactive, { color: colors.mutedForeground }]}>
                      {CATEGORY_LABELS[cat]}
                    </Text>
                  </View>
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {tags.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>TAGS</Text>
            <View style={styles.tagsWrap}>
              {tags.map((tag) => (
                <Pressable
                  key={tag}
                  style={[
                    styles.tagChip,
                    { backgroundColor: colors.surfaceWash, borderColor: colors.border },
                  ]}
                  onPress={() => removeTag(tag)}
                >
                  <Text style={[styles.tagText, { color: colors.foreground }]}>{tag}</Text>
                  <Feather name="x" size={12} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>NAME (OPTIONAL)</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={CATEGORY_LABELS[category]}
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.nameInput,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.foreground,
                fontFamily: "Poppins_400Regular",
              },
            ]}
          />
        </View>
      </ScrollView>

      <View
        style={[
          styles.saveBar,
          { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: pb },
        ]}
      >
        <GradientButton onPress={handleSave} isLoading={isSaving} label="Save to wardrobe" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center" },
  sheetHandle: { alignItems: "center", paddingBottom: 8 },
  handle: { width: 32, height: 4, borderRadius: 2 },
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
    fontFamily: "Poppins_700Bold",
    paddingHorizontal: 24,
    marginTop: 8,
  },
  sheetSubtitle: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    paddingHorizontal: 24,
    marginTop: 6,
    marginBottom: 32,
  },
  pickOptions: { flexDirection: "row", paddingHorizontal: 20, gap: 14 },
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
  pickOptionLabel: { fontSize: 15, fontFamily: "Poppins_600SemiBold" },
  pickOptionSub: { fontSize: 12, fontFamily: "Poppins_400Regular", textAlign: "center" },
  analyzingPreview: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  analyzingOverlay: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 40,
    paddingVertical: 32,
    borderRadius: 20,
  },
  analyzingText: { fontSize: 17, fontFamily: "Poppins_600SemiBold" },
  analyzingSubtext: { fontSize: 13, fontFamily: "Poppins_400Regular", textAlign: "center" },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reviewTitle: { fontSize: 17, fontFamily: "Poppins_600SemiBold" },
  reviewContent: { paddingHorizontal: 20, paddingTop: 20, gap: 24 },
  reviewImage: { width: "100%", aspectRatio: 0.75, borderRadius: 16 },
  section: { gap: 10 },
  label: { fontSize: 11, fontFamily: "Poppins_600SemiBold", letterSpacing: 0.8 },
  colorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  colorDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1 },
  colorName: { fontSize: 15, fontFamily: "Poppins_500Medium" },
  pillRow: { flexDirection: "row" },
  pillWrapper: { marginRight: 8 },
  pillActive: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  pillTextActive: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: "#FFFFFF" },
  pillInactive: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  pillTextInactive: { fontSize: 13, fontFamily: "Poppins_500Medium" },
  tagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  tagText: { fontSize: 12, fontFamily: "Poppins_400Regular" },
  nameInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  saveBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
