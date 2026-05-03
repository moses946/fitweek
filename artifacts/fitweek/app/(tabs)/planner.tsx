import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as FileSystem from "expo-file-system/legacy";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import brandColors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useGarments } from "@/contexts/GarmentContext";
import { useOutfitSlots } from "@/contexts/OutfitSlotContext";
import { useWeather } from "@/contexts/WeatherContext";
import { useColors } from "@/hooks/useColors";
import { generateICS, generateShareCard, ICS_MIME_TYPE } from "@/lib/ics";
import type { DailyForecast } from "@/lib/weather";
import type { Garment, OutfitSlot } from "@/lib/types";
import { selectHeroGarment, callVTO, VtoError } from "@/lib/vto";
import { buildSuggestionDeck } from "@/lib/suggestionFilter";

// ── Date helpers ──────────────────────────────────────────────────────────────

function getWeekDays(from: Date = new Date()): Date[] {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/** Short weekday name from the date's local day-of-week. */
function dayLabel(d: Date): string {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]!;
}

const WEATHER_EMOJI: Record<string, string> = {
  clear: "☀️",
  cloudy: "⛅",
  rainy: "🌧️",
  snowy: "❄️",
  windy: "💨",
  thunderstorm: "⛈️",
};

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDayHeader(isoDate: string): string {
  try {
    const [y, m, d] = isoDate.split("-").map(Number);
    return new Date(y!, m! - 1, d!).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CachedBanner() {
  const colors = useColors();
  return (
    <View style={[styles.banner, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      <Feather name="clock" size={12} color={colors.mutedForeground} />
      <Text style={[styles.bannerText, { color: colors.mutedForeground }]}>
        Using cached forecast
      </Text>
    </View>
  );
}

function UnavailableBanner() {
  return (
    <View style={[styles.banner, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]}>
      <Feather name="alert-circle" size={12} color="#92400E" />
      <Text style={[styles.bannerText, { color: "#92400E" }]}>
        Weather unavailable — showing all garments
      </Text>
    </View>
  );
}

interface DayCellProps {
  date: Date;
  label: string;
  isToday: boolean;
  isSelected: boolean;
  forecast: DailyForecast | undefined;
  slot: OutfitSlot | undefined;
  onPress: () => void;
}

function DayCell({ date, label, isToday, isSelected, forecast, slot, onPress }: DayCellProps) {
  const colors = useColors();
  const hasOutfit = slot?.status === "confirmed";
  const weatherEmoji = forecast ? (WEATHER_EMOJI[forecast.condition] ?? "🌡️") : "–";
  const weatherTemp = forecast ? `${forecast.tempMax}°` : "";

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.dayCell,
        {
          backgroundColor: isSelected ? colors.primary : colors.card,
          borderColor: isToday && !isSelected ? colors.primary : colors.border,
          borderWidth: isToday && !isSelected ? 1.5 : 1,
        },
      ]}
    >
      <Text style={[styles.dayLabel, { color: isSelected ? "#FFFFFF" : (isToday ? colors.primary : colors.mutedForeground) }]}>
        {label}
      </Text>
      <Text style={[styles.dayDate, { color: isSelected ? "#FFFFFF" : colors.foreground }]}>
        {date.getDate()}
      </Text>
      <Text style={styles.weatherEmoji}>{weatherEmoji}</Text>
      {weatherTemp ? (
        <Text style={[styles.weatherTemp, { color: isSelected ? "rgba(255,255,255,0.8)" : colors.mutedForeground }]}>
          {weatherTemp}
        </Text>
      ) : null}
      {hasOutfit && (
        <View style={[styles.outfitDot, { backgroundColor: isSelected ? "#FFFFFF" : colors.primary }]} />
      )}
    </Pressable>
  );
}

interface ConfirmedOutfitCardProps {
  slot: OutfitSlot;
  garments: Garment[];
  onEdit: () => void;
  onClear: () => void;
  onMarkAllWorn: () => void;
  onRename: () => void;
  onGenerateVto: () => void;
  onShare: () => void;
}

function ConfirmedOutfitCard({
  slot,
  garments,
  onEdit,
  onClear,
  onMarkAllWorn,
  onRename,
  onGenerateVto,
  onShare,
}: ConfirmedOutfitCardProps) {
  const colors = useColors();
  const assembledGarments = slot.garmentIds
    .map((id) => garments.find((g) => g.id === id))
    .filter((g): g is Garment => Boolean(g));

  return (
    <View style={[styles.outfitCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* VTO result image (shown when generated) */}
      {slot.vtoImageUrl ? (
        <View style={styles.vtoImageWrap}>
          <Image
            source={{ uri: slot.vtoImageUrl }}
            style={styles.vtoImage}
            contentFit="cover"
          />
          <Pressable onPress={onGenerateVto} style={styles.vtoRegenerateBtn}>
            <Feather name="refresh-cw" size={12} color="#FFFFFF" />
            <Text style={styles.vtoRegenerateLabel}>Regenerate</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Outfit name */}
      <Pressable onPress={onRename} style={styles.outfitNameRow}>
        <Text style={[styles.outfitName, { color: colors.foreground }]}>
          {slot.name ?? "Outfit"}
        </Text>
        <Feather name="edit-2" size={13} color={colors.mutedForeground} />
      </Pressable>

      {/* Garment thumbnails */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.outfitThumbnails}
      >
        {assembledGarments.map((g) => (
          <Image
            key={g.id}
            source={{ uri: g.imageUri }}
            style={styles.outfitThumb}
            contentFit="cover"
          />
        ))}
        {assembledGarments.length === 0 && (
          <Text style={[styles.emptyThumbText, { color: colors.mutedForeground }]}>
            No garments added
          </Text>
        )}
      </ScrollView>

      {/* VTO + Share row */}
      <View style={styles.outfitActions}>
        <Pressable
          style={[styles.actionBtn, { borderColor: colors.primary, flex: 2 }]}
          onPress={onGenerateVto}
        >
          <Feather name="camera" size={13} color={colors.primary} />
          <Text style={[styles.actionText, { color: colors.primary }]}>
            {slot.vtoImageUrl ? "Re-try on" : "Try on"}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, { borderColor: colors.border }]}
          onPress={onShare}
        >
          <Feather name="share-2" size={13} color={colors.foreground} />
          <Text style={[styles.actionText, { color: colors.foreground }]}>Share</Text>
        </Pressable>
      </View>

      {/* Management row */}
      <View style={styles.outfitActions}>
        <Pressable
          style={[styles.actionBtn, { borderColor: colors.border }]}
          onPress={onMarkAllWorn}
        >
          <Feather name="check-circle" size={13} color={colors.foreground} />
          <Text style={[styles.actionText, { color: colors.foreground }]}>
            Mark worn
          </Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, { borderColor: colors.border }]}
          onPress={onEdit}
        >
          <Feather name="edit" size={13} color={colors.foreground} />
          <Text style={[styles.actionText, { color: colors.foreground }]}>
            Edit
          </Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, { borderColor: "#EF4444" }]}
          onPress={onClear}
        >
          <Feather name="trash-2" size={13} color="#EF4444" />
          <Text style={[styles.actionText, { color: "#EF4444" }]}>
            Clear
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── VTO loading overlay ───────────────────────────────────────────────────────

function VtoOverlay({ onCancel }: { onCancel: () => void }) {
  const colors = useColors();
  return (
    <Modal transparent animationType="fade">
      <View style={styles.vtoOverlay}>
        <View style={[styles.vtoOverlayCard, { backgroundColor: colors.card }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.vtoOverlayTitle, { color: colors.foreground }]}>
            Generating your try-on
          </Text>
          <Text style={[styles.vtoOverlayBody, { color: colors.mutedForeground }]}>
            This can take up to 60 seconds while the AI processes your outfit.
          </Text>
          <Pressable
            onPress={onCancel}
            style={[styles.vtoCancelBtn, { borderColor: colors.border }]}
          >
            <Text style={[styles.vtoCancelLabel, { color: colors.mutedForeground }]}>
              Cancel
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ── Location + city input helpers ─────────────────────────────────────────────

function LocationPrompt({
  onRequestGPS,
  onOpenCityInput,
}: {
  onRequestGPS: () => void;
  onOpenCityInput: () => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.locationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Feather name="map-pin" size={24} color={colors.primary} />
      <Text style={[styles.locationTitle, { color: colors.foreground }]}>
        Share your location
      </Text>
      <Text style={[styles.locationBody, { color: colors.mutedForeground }]}>
        FitWeek uses weather to suggest weather-appropriate outfits.
      </Text>
      <View style={styles.locationActions}>
        <Pressable onPress={onRequestGPS} style={{ flex: 1 }}>
          <LinearGradient
            colors={brandColors.gradientPrimary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.locationBtn}
          >
            <Feather name="navigation" size={14} color="#FFFFFF" />
            <Text style={styles.locationBtnLabel}>Use GPS</Text>
          </LinearGradient>
        </Pressable>
        <Pressable
          onPress={onOpenCityInput}
          style={[styles.locationBtnOutline, { borderColor: colors.border, flex: 1 }]}
        >
          <Text style={[styles.locationBtnOutlineLabel, { color: colors.foreground }]}>
            Enter city
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function CityInputCard({ onSubmit, onCancel }: { onSubmit: (c: string) => void; onCancel: () => void }) {
  const colors = useColors();
  const [value, setValue] = useState("");
  return (
    <View style={[styles.locationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.locationTitle, { color: colors.foreground }]}>Enter your city</Text>
      <TextInput
        style={[styles.cityInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
        placeholder="e.g. London, Tokyo, New York"
        placeholderTextColor={colors.mutedForeground}
        value={value}
        onChangeText={setValue}
        onSubmitEditing={() => value.trim() && onSubmit(value.trim())}
        returnKeyType="done"
        autoFocus
      />
      <View style={styles.locationActions}>
        <Pressable onPress={() => value.trim() && onSubmit(value.trim())} style={{ flex: 1 }}>
          <LinearGradient colors={brandColors.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.locationBtn}>
            <Text style={styles.locationBtnLabel}>Confirm</Text>
          </LinearGradient>
        </Pressable>
        <Pressable onPress={onCancel} style={[styles.locationBtnOutline, { borderColor: colors.border, flex: 1 }]}>
          <Text style={[styles.locationBtnOutlineLabel, { color: colors.foreground }]}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

type UIMode = "idle" | "enterCity";

export default function PlannerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { modelImageUrl } = useAuth();
  const { garments } = useGarments();
  const { slots, clearSlot, markAllWornInSlot, renameSlot, updateSlotVtoImage, bulkWriteDrafts } = useOutfitSlots();
  const {
    forecast,
    usingCache,
    weatherUnavailable,
    isLoading,
    locationPermission,
    city,
    requestLocationAndFetch,
    setCity,
  } = useWeather();

  const weekDays = getWeekDays();
  const todayStr = toISODate(new Date());

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [uiMode, setUIMode] = useState<UIMode>("idle");
  const [vtoLoading, setVtoLoading] = useState(false);
  const [weekSuggesting, setWeekSuggesting] = useState(false);

  const vtoControllerRef = useRef<AbortController | null>(null);

  const forecastByDate = new Map<string, DailyForecast>(
    (forecast ?? []).map((f) => [f.date, f]),
  );
  const slotByDate = new Map<string, OutfitSlot>(
    slots.map((s) => [s.date, s]),
  );

  const selectedSlot = slotByDate.get(selectedDate);
  const selectedForecast = forecastByDate.get(selectedDate);
  const showLocationPrompt =
    locationPermission !== "granted" && !city && !forecast;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handlePlanDay = () => {
    router.push({ pathname: "/(swipe)/[date]", params: { date: selectedDate } });
  };

  const getProxyBase = () => {
    if (typeof window !== "undefined") return "";
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    return domain ? `https://${domain}` : "http://localhost:8080";
  };

  const handleSuggestForDay = async () => {
    const eligibleGarments = buildSuggestionDeck(garments, forecastByDate.get(selectedDate) ?? null);
    if (!eligibleGarments.length) {
      Alert.alert("No garments", "Add some clean garments to your closet first.");
      return;
    }
    setWeekSuggesting(true);
    try {
      const res = await fetch(`${getProxyBase()}/api/outfit/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dates: [selectedDate],
          garments,
          forecasts: forecast ?? [],
        }),
      });
      if (!res.ok) throw new Error("Suggest failed");
      const { suggestions } = await res.json() as { suggestions: Record<string, string[]> };
      await bulkWriteDrafts(suggestions);
      router.push({ pathname: "/(swipe)/[date]", params: { date: selectedDate } });
    } catch {
      Alert.alert("Suggestion failed", "Could not generate a suggestion. Try again.");
    } finally {
      setWeekSuggesting(false);
    }
  };

  const handlePlanWeek = () => {
    const allConfirmed = weekDays
      .map(toISODate)
      .every((d) => slotByDate.get(d)?.status === "confirmed");
    if (allConfirmed) {
      Alert.alert("All set!", "You have confirmed outfits for every day this week.");
      return;
    }
    const cleanCount = garments.filter((g) => g.status === "clean" && !g.deletedAt).length;
    if (cleanCount < 10) {
      Alert.alert(
        "More clothes needed",
        `Add at least 10 clean items to plan your week (you have ${cleanCount}). Head to your closet to add more.`,
      );
      return;
    }
    router.push("/(swipe)/plan-week");
  };

  const handleEditSlot = (slot: OutfitSlot) => {
    router.push({ pathname: "/(swipe)/[date]", params: { date: slot.date } });
  };

  const handleClearSlot = (slot: OutfitSlot) => {
    Alert.alert(
      "Clear outfit?",
      "This will remove all selected pieces for this day.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear", style: "destructive", onPress: () => clearSlot(slot.id) },
      ],
    );
  };

  const handleMarkAllWorn = (slot: OutfitSlot) => {
    Alert.alert(
      "Mark all worn?",
      "All pieces in this outfit will be moved to the laundry pile.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Mark worn", onPress: () => markAllWornInSlot(slot.id) },
      ],
    );
  };

  const handleRename = (slot: OutfitSlot) => {
    Alert.prompt?.(
      "Rename outfit",
      "Give this outfit a name",
      (name) => { if (name?.trim()) renameSlot(slot.id, name.trim()); },
      "plain-text",
      slot.name ?? "",
    ) ?? Alert.alert("Rename", "Rename is only supported on iOS.");
  };

  const handleGenerateVto = async (slot: OutfitSlot) => {
    console.log("[VTO] ── handleGenerateVto START ──");
    console.log("[VTO] slot.id:", slot.id, "garmentIds:", slot.garmentIds);

    if (!modelImageUrl) {
      console.warn("[VTO] BLOCKED — no modelImageUrl. Add a model photo in Profile.");
      Alert.alert(
        "No model photo",
        "Add a model photo in your profile to use Try-On.",
        [{ text: "OK" }],
      );
      return;
    }
    console.log("[VTO] modelImageUrl present:", modelImageUrl.slice(0, 60) + "…");

    const slotGarments = slot.garmentIds
      .map((id) => garments.find((g) => g.id === id))
      .filter((g): g is Garment => g != null && g.deletedAt === null);

    console.log("[VTO] slotGarments resolved:", slotGarments.map((g) => `${g.name}(${g.category})`));

    const hero = selectHeroGarment(slotGarments);
    if (!hero) {
      console.warn("[VTO] BLOCKED — no hero garment selected (slot may be empty).");
      Alert.alert("No garments", "Add some garments to this outfit first.");
      return;
    }
    console.log("[VTO] hero garment:", hero.name, "category:", hero.category, "imageUri:", hero.imageUri.slice(0, 80));

    // Read garment image as base64 to send to the server-side VTO proxy
    let garmentBase64: string;
    try {
      if (hero.imageUri.startsWith("http")) {
        console.log("[VTO] Fetching garment image from remote URL…");
        const imgRes = await fetch(hero.imageUri);
        console.log("[VTO] Garment fetch status:", imgRes.status);
        if (!imgRes.ok) throw new Error(`Garment image fetch failed: ${imgRes.status}`);
        const arrayBuf = await imgRes.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        garmentBase64 = btoa(binary);
        console.log("[VTO] Garment base64 length:", garmentBase64.length);
      } else {
        console.log("[VTO] Reading garment image from local file system…");
        garmentBase64 = await FileSystem.readAsStringAsync(hero.imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        console.log("[VTO] Garment base64 length (local):", garmentBase64.length);
      }
    } catch (err) {
      console.error("[VTO] ERROR reading garment image:", err);
      Alert.alert("Try-on failed", "Could not read garment image.");
      return;
    }

    // Build a meaningful description — "Other" confuses IDM-VTON and causes blank output
    const garmentDesc = (() => {
      if (hero.aiDescription) return hero.aiDescription;
      const nameLower = hero.name.toLowerCase();
      if (nameLower === "other" || nameLower === hero.category.toLowerCase()) {
        return `${hero.category} garment`;
      }
      return `${hero.name}, ${hero.category} garment`;
    })();
    console.log("[VTO] garmentDescription:", garmentDesc);

    // If the model photo is a local file URI (Supabase upload failed / iOS Expo Go),
    // read it as base64 on-device so the server doesn't have to fetch a file:// URL.
    let modelBase64: string | undefined;
    const isLocalModelUri =
      !modelImageUrl.startsWith("http://") && !modelImageUrl.startsWith("https://");

    if (isLocalModelUri) {
      console.log("[VTO] modelImageUrl is a local URI — reading as base64 on-device…");
      try {
        modelBase64 = await FileSystem.readAsStringAsync(modelImageUrl, {
          encoding: FileSystem.EncodingType.Base64,
        });
        console.log("[VTO] model base64 length:", modelBase64.length);
      } catch (err) {
        console.error("[VTO] ERROR reading model image from local URI:", err);
        Alert.alert("Try-on failed", "Could not read your model photo from device.");
        return;
      }
    }

    const controller = new AbortController();
    vtoControllerRef.current = controller;
    setVtoLoading(true);
    console.log("[VTO] Calling proxy /api/vto/tryon… modelBase64:", modelBase64 ? "yes" : "no (using URL)");

    try {
      const resultUrl = await callVTO(
        isLocalModelUri ? null : modelImageUrl,
        garmentBase64,
        garmentDesc,
        controller.signal,
        modelBase64,
      );
      console.log("[VTO] callVTO returned resultUrl:", resultUrl ? resultUrl.slice(0, 80) : "(empty)");
      if (resultUrl) {
        await updateSlotVtoImage(slot.id, resultUrl);
        console.log("[VTO] Slot VTO image updated successfully.");
      }
    } catch (err) {
      console.error("[VTO] callVTO threw:", err);
      if (err instanceof VtoError) {
        console.error("[VTO] VtoError code:", err.code, "message:", err.message);
        if (err.code === "VTO_TIMEOUT") {
          Alert.alert(
            "Try-on is busy",
            "The AI is busy right now — try again in a few minutes.",
          );
        } else {
          Alert.alert("Try-on failed", err.message || "Something went wrong. Please try again.");
        }
      } else {
        Alert.alert("Try-on failed", String(err));
      }
    } finally {
      setVtoLoading(false);
      vtoControllerRef.current = null;
      console.log("[VTO] ── handleGenerateVto END ──");
    }
  };

  const handleCancelVto = () => {
    vtoControllerRef.current?.abort();
    setVtoLoading(false);
  };

  const handleShare = async (slot: OutfitSlot) => {
    const card = generateShareCard(
      slot,
      garments,
      forecastByDate.get(slot.date),
    );
    const garmentNames = garments
      .filter((g) => slot.garmentIds.includes(g.id) && g.deletedAt === null)
      .map((g) => g.name)
      .join(", ");
    const message = [
      `👗 ${slot.name ?? "My outfit"} — ${card.dayLabel}`,
      garmentNames ? `Pieces: ${garmentNames}` : null,
      card.weatherSummary ? `Weather: ${card.weatherSummary}` : null,
      card.type === "vto" && card.primaryImageUri ? card.primaryImageUri : null,
    ]
      .filter(Boolean)
      .join("\n");

    await Share.share({ message });
  };

  const handleExportCalendar = async () => {
    const confirmedSlots = slots.filter((s) => s.status === "confirmed");
    if (confirmedSlots.length === 0) {
      Alert.alert("Nothing to export", "Confirm at least one outfit to export.");
      return;
    }

    const ics = generateICS(confirmedSlots, garments, forecast ?? []);

    try {
      const cacheDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? "";
      const fileUri = `${cacheDir}fitweek-outfits.ics`;
      await FileSystem.writeAsStringAsync(fileUri, ics, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: ICS_MIME_TYPE,
          dialogTitle: "Export FitWeek calendar",
          UTI: "public.calendar",
        });
      } else {
        Alert.alert("Sharing not available", "Your device does not support file sharing.");
      }
    } catch {
      Alert.alert("Export failed", "Could not export the calendar file.");
    }
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
      {vtoLoading && <VtoOverlay onCancel={handleCancelVto} />}

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>This Week</Text>
        <View style={styles.headerRight}>
          {city && (
            <View style={styles.cityChip}>
              <Feather name="map-pin" size={11} color={colors.mutedForeground} />
              <Text style={[styles.cityLabel, { color: colors.mutedForeground }]}>{city}</Text>
            </View>
          )}
          <Pressable onPress={handleExportCalendar} style={styles.exportBtn} hitSlop={8}>
            <Feather name="calendar" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      {/* Plan my week CTA */}
      {!showLocationPrompt && uiMode === "idle" && (
        <Pressable
          onPress={handlePlanWeek}
          style={({ pressed }) => [styles.planWeekBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <LinearGradient
            colors={brandColors.gradientPrimary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.planWeekGradient}
          >
            <Feather name="zap" size={14} color="#FFF" />
            <Text style={styles.planWeekLabel}>Plan my week</Text>
          </LinearGradient>
        </Pressable>
      )}

      {usingCache && <CachedBanner />}
      {weatherUnavailable && !showLocationPrompt && <UnavailableBanner />}
      {isLoading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Fetching forecast…</Text>
        </View>
      )}

      {/* Single vertical ScrollView — holds day strip + day detail */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.mainScroll,
          { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 80 },
        ]}
        nestedScrollEnabled
      >
        {/* Day strip — horizontally scrollable */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayStrip}
          nestedScrollEnabled
        >
          {weekDays.map((date) => {
            const isoDate = toISODate(date);
            return (
              <DayCell
                key={isoDate}
                date={date}
                label={dayLabel(date)}
                isToday={isoDate === todayStr}
                isSelected={isoDate === selectedDate}
                forecast={forecastByDate.get(isoDate)}
                slot={slotByDate.get(isoDate)}
                onPress={() => setSelectedDate(isoDate)}
              />
            );
          })}
        </ScrollView>

        {/* Selected day detail — inline, no inner ScrollView */}
        <View style={styles.contentInner}>
          {uiMode === "enterCity" ? (
            <CityInputCard
              onSubmit={async (c) => { setUIMode("idle"); await setCity(c); }}
              onCancel={() => setUIMode("idle")}
            />
          ) : showLocationPrompt ? (
            <LocationPrompt
              onRequestGPS={requestLocationAndFetch}
              onOpenCityInput={() => setUIMode("enterCity")}
            />
          ) : selectedSlot?.status === "confirmed" ? (
            <>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                {formatDayHeader(selectedDate)}
              </Text>
              <ConfirmedOutfitCard
                slot={selectedSlot}
                garments={garments}
                onEdit={() => handleEditSlot(selectedSlot)}
                onClear={() => handleClearSlot(selectedSlot)}
                onMarkAllWorn={() => handleMarkAllWorn(selectedSlot)}
                onRename={() => handleRename(selectedSlot)}
                onGenerateVto={() => handleGenerateVto(selectedSlot)}
                onShare={() => handleShare(selectedSlot)}
              />
            </>
          ) : (
            <>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                {formatDayHeader(selectedDate)}
              </Text>
              {selectedSlot?.status === "draft" && selectedSlot.garmentIds.length > 0 && (
                <View style={[styles.draftBanner, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Feather name="edit" size={13} color={colors.mutedForeground} />
                  <Text style={[styles.bannerText, { color: colors.mutedForeground }]}>
                    Draft in progress — {selectedSlot.garmentIds.length} piece{selectedSlot.garmentIds.length !== 1 ? "s" : ""} selected
                  </Text>
                </View>
              )}
              <View style={styles.emptyState}>
                <View style={[styles.emptyIconWrap, { backgroundColor: colors.muted }]}>
                  <Feather name="calendar" size={32} color={colors.mutedForeground} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  {selectedSlot?.garmentIds.length ? "Continue planning?" : "No outfit planned"}
                </Text>
                <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
                  {selectedForecast
                    ? `It'll be ${selectedForecast.tempMax}° and ${selectedForecast.conditionLabel}. Dress accordingly!`
                    : "Tap below to build your outfit for this day."}
                </Text>

                <Pressable onPress={handlePlanDay}>
                  <LinearGradient
                    colors={brandColors.gradientPrimary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.planBtn}
                  >
                    <Feather name={selectedSlot?.garmentIds.length ? "edit" : "plus"} size={16} color="#FFFFFF" />
                    <Text style={styles.planBtnText}>
                      {selectedSlot?.garmentIds.length ? "Continue planning" : "Plan outfit"}
                    </Text>
                  </LinearGradient>
                </Pressable>

                {!selectedSlot?.garmentIds.length && (
                  <Pressable
                    onPress={handleSuggestForDay}
                    disabled={weekSuggesting}
                    style={[
                      styles.suggestDayBtn,
                      { borderColor: colors.primary, opacity: weekSuggesting ? 0.6 : 1 },
                    ]}
                  >
                    {weekSuggesting ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Feather name="zap" size={14} color={colors.primary} />
                    )}
                    <Text style={[styles.suggestDayText, { color: colors.primary }]}>
                      Suggest outfit
                    </Text>
                  </Pressable>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>
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
  title: { fontSize: 28, fontFamily: "Poppins_700Bold", letterSpacing: -0.5 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  cityChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  cityLabel: { fontSize: 12, fontFamily: "Poppins_400Regular" },
  exportBtn: { padding: 4 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  draftBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  bannerText: { fontSize: 12, fontFamily: "Poppins_400Regular" },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 10,
    gap: 8,
  },
  loadingText: { fontSize: 13, fontFamily: "Poppins_400Regular" },
  mainScroll: { flexGrow: 1 },
  dayStrip: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 4,
    gap: 8,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  dayCell: {
    width: 68,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
    gap: 2,
  },
  dayLabel: { fontSize: 11, fontFamily: "Poppins_600SemiBold" },
  dayDate: { fontSize: 16, fontFamily: "Poppins_700Bold" },
  weatherEmoji: { fontSize: 16, lineHeight: 20 },
  weatherTemp: { fontSize: 10, fontFamily: "Poppins_500Medium" },
  outfitDot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  contentInner: { paddingHorizontal: 20, paddingBottom: 20 },
  sectionLabel: { fontSize: 13, fontFamily: "Poppins_500Medium", marginBottom: 12 },
  // Confirmed outfit card
  outfitCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  vtoImageWrap: { borderRadius: 12, overflow: "hidden", position: "relative" },
  vtoImage: { width: "100%", height: 260, borderRadius: 12 },
  vtoRegenerateBtn: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  vtoRegenerateLabel: { color: "#FFFFFF", fontSize: 11, fontFamily: "Poppins_500Medium" },
  outfitNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  outfitName: { fontSize: 17, fontFamily: "Poppins_600SemiBold", flex: 1 },
  outfitThumbnails: { gap: 8, flexDirection: "row" },
  outfitThumb: { width: 72, height: 72, borderRadius: 10 },
  emptyThumbText: { fontSize: 13, fontFamily: "Poppins_400Regular" },
  outfitActions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionText: { fontSize: 12, fontFamily: "Poppins_500Medium" },
  // VTO overlay
  vtoOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  vtoOverlayCard: {
    width: "85%",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    gap: 16,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  vtoOverlayTitle: { fontSize: 17, fontFamily: "Poppins_600SemiBold", textAlign: "center" },
  vtoOverlayBody: { fontSize: 14, fontFamily: "Poppins_400Regular", textAlign: "center", lineHeight: 20 },
  vtoCancelBtn: {
    marginTop: 4,
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  vtoCancelLabel: { fontSize: 14, fontFamily: "Poppins_500Medium" },
  // Empty state
  emptyState: { alignItems: "center", paddingTop: 20, gap: 12, paddingBottom: 40 },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontFamily: "Poppins_600SemiBold", textAlign: "center" },
  emptyBody: { fontSize: 14, fontFamily: "Poppins_400Regular", textAlign: "center", lineHeight: 20 },
  planBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    gap: 8,
    marginTop: 4,
  },
  planBtnText: { color: "#FFFFFF", fontSize: 15, fontFamily: "Poppins_600SemiBold" },
  // Suggest outfit (single-day)
  suggestDayBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 7,
    marginTop: 2,
  },
  suggestDayText: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  // Plan my week banner
  planWeekBtn: { marginHorizontal: 20, marginBottom: 8 },
  planWeekGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 7,
  },
  planWeekLabel: { color: "#FFF", fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  // Location prompt
  locationCard: { borderRadius: 16, borderWidth: 1, padding: 24, gap: 12, alignItems: "center" },
  locationTitle: { fontSize: 16, fontFamily: "Poppins_600SemiBold" },
  locationBody: { fontSize: 14, fontFamily: "Poppins_400Regular", textAlign: "center", lineHeight: 20 },
  locationActions: { flexDirection: "row", gap: 10, width: "100%", marginTop: 4 },
  locationBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 12, gap: 6 },
  locationBtnLabel: { color: "#FFFFFF", fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  locationBtnOutline: { alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  locationBtnOutlineLabel: { fontSize: 14, fontFamily: "Poppins_500Medium" },
  cityInput: { width: "100%", borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Poppins_400Regular" },
});
