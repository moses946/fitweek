import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WeatherBadge, WeatherUnavailableBadge } from "@/components/WeatherBadge";
import brandColors from "@/constants/colors";
import { useWeather } from "@/contexts/WeatherContext";
import { useColors } from "@/hooks/useColors";
import type { DailyForecast } from "@/lib/weather";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWeekDays(from: Date = new Date()): Date[] {
  const days: Date[] = [];
  const start = new Date(from);
  // Align to Monday of the current week
  const dayOfWeek = start.getDay(); // 0=Sun
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0]!;
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
  const colors = useColors();
  return (
    <View style={[styles.banner, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]}>
      <Feather name="alert-circle" size={12} color="#92400E" />
      <Text style={[styles.bannerText, { color: "#92400E" }]}>
        Weather unavailable — showing all garments
      </Text>
    </View>
  );
}

interface LocationPromptProps {
  onRequestGPS: () => void;
  onOpenCityInput: () => void;
}

function LocationPrompt({ onRequestGPS, onOpenCityInput }: LocationPromptProps) {
  const colors = useColors();
  return (
    <View style={[styles.locationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Feather name="map-pin" size={24} color={colors.primary} />
      <Text style={[styles.locationTitle, { color: colors.foreground }]}>
        Share your location
      </Text>
      <Text style={[styles.locationBody, { color: colors.mutedForeground }]}>
        FitWeek uses weather to suggest what to wear. Grant location access or
        enter your city manually.
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

interface CityInputCardProps {
  onSubmit: (city: string) => void;
  onCancel: () => void;
}

function CityInputCard({ onSubmit, onCancel }: CityInputCardProps) {
  const colors = useColors();
  const [value, setValue] = useState("");

  return (
    <View style={[styles.locationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.locationTitle, { color: colors.foreground }]}>
        Enter your city
      </Text>
      <TextInput
        style={[
          styles.cityInput,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            color: colors.foreground,
          },
        ]}
        placeholder="e.g. London, Tokyo, New York"
        placeholderTextColor={colors.mutedForeground}
        value={value}
        onChangeText={setValue}
        onSubmitEditing={() => value.trim() && onSubmit(value.trim())}
        returnKeyType="done"
        autoFocus
      />
      <View style={styles.locationActions}>
        <Pressable
          onPress={() => value.trim() && onSubmit(value.trim())}
          style={{ flex: 1 }}
        >
          <LinearGradient
            colors={brandColors.gradientPrimary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.locationBtn}
          >
            <Text style={styles.locationBtnLabel}>Confirm</Text>
          </LinearGradient>
        </Pressable>
        <Pressable
          onPress={onCancel}
          style={[styles.locationBtnOutline, { borderColor: colors.border, flex: 1 }]}
        >
          <Text style={[styles.locationBtnOutlineLabel, { color: colors.foreground }]}>
            Cancel
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

interface DayCellProps {
  date: Date;
  label: string;
  isToday: boolean;
  forecast: DailyForecast | undefined;
  weatherUnavailable: boolean;
  overrideWeather: boolean;
  onToggleOverride: () => void;
}

function DayCell({
  date,
  label,
  isToday,
  forecast,
  weatherUnavailable,
  overrideWeather,
  onToggleOverride,
}: DayCellProps) {
  const colors = useColors();
  const dateNum = date.getDate();

  return (
    <View
      style={[
        styles.dayCell,
        {
          backgroundColor: colors.card,
          borderColor: isToday ? colors.primary : colors.border,
          borderWidth: isToday ? 1.5 : 1,
        },
      ]}
    >
      <Text style={[styles.dayLabel, { color: isToday ? colors.primary : colors.mutedForeground }]}>
        {label}
      </Text>
      <Text style={[styles.dayDate, { color: colors.foreground }]}>
        {dateNum}
      </Text>

      {/* Weather badge */}
      <View style={styles.weatherRow}>
        {forecast ? (
          <WeatherBadge forecast={forecast} size="compact" />
        ) : (
          <WeatherUnavailableBadge />
        )}
      </View>

      {/* Override toggle */}
      {(forecast || weatherUnavailable) && (
        <Pressable onPress={onToggleOverride} hitSlop={8}>
          <View style={[
            styles.overrideChip,
            {
              backgroundColor: overrideWeather ? colors.primary + "20" : "transparent",
              borderColor: overrideWeather ? colors.primary : colors.border,
            },
          ]}>
            <Text style={[
              styles.overrideText,
              { color: overrideWeather ? colors.primary : colors.mutedForeground },
            ]}>
              {overrideWeather ? "All" : "Filtered"}
            </Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

type UIMode = "idle" | "enterCity";

export default function PlannerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
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

  const [uiMode, setUIMode] = useState<UIMode>("idle");
  // Per-day weather override: set of ISO date strings where user toggled override
  const [overrideDays, setOverrideDays] = useState<Set<string>>(new Set());

  const weekDays = getWeekDays();
  const todayStr = toISODate(new Date());

  const forecastByDate = new Map<string, DailyForecast>(
    (forecast ?? []).map((f) => [f.date, f]),
  );

  const showLocationPrompt =
    locationPermission !== "granted" && !city && !forecast;

  const handleToggleOverride = (isoDate: string) => {
    setOverrideDays((prev) => {
      const next = new Set(prev);
      if (next.has(isoDate)) next.delete(isoDate);
      else next.add(isoDate);
      return next;
    });
  };

  const handleCitySubmit = async (cityName: string) => {
    setUIMode("idle");
    await setCity(cityName);
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>This Week</Text>
        {city && (
          <View style={styles.cityChip}>
            <Feather name="map-pin" size={11} color={colors.mutedForeground} />
            <Text style={[styles.cityLabel, { color: colors.mutedForeground }]}>{city}</Text>
          </View>
        )}
      </View>

      {/* Status banners */}
      {usingCache && <CachedBanner />}
      {weatherUnavailable && !showLocationPrompt && <UnavailableBanner />}

      {/* Loading indicator */}
      {isLoading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Fetching forecast…
          </Text>
        </View>
      )}

      {/* Week day strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayStrip}
      >
        {weekDays.map((date, i) => {
          const isoDate = toISODate(date);
          return (
            <DayCell
              key={isoDate}
              date={date}
              label={DAY_LABELS[i]!}
              isToday={isoDate === todayStr}
              forecast={forecastByDate.get(isoDate)}
              weatherUnavailable={weatherUnavailable}
              overrideWeather={overrideDays.has(isoDate)}
              onToggleOverride={() => handleToggleOverride(isoDate)}
            />
          );
        })}
      </ScrollView>

      {/* Location prompt or city input */}
      <View style={styles.content}>
        {uiMode === "enterCity" ? (
          <CityInputCard
            onSubmit={handleCitySubmit}
            onCancel={() => setUIMode("idle")}
          />
        ) : showLocationPrompt ? (
          <LocationPrompt
            onRequestGPS={requestLocationAndFetch}
            onOpenCityInput={() => setUIMode("enterCity")}
          />
        ) : (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.muted }]}>
              <Feather name="calendar" size={32} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No outfits planned yet
            </Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              The swipe deck is coming in the next update — tap a day to start planning.
            </Text>
            {!city && locationPermission !== "granted" && (
              <Pressable
                style={styles.changeCityBtn}
                onPress={() => setUIMode("enterCity")}
              >
                <Feather name="map-pin" size={13} color={colors.primary} />
                <Text style={[styles.changeCityText, { color: colors.primary }]}>
                  Change city
                </Text>
              </Pressable>
            )}
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
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  cityChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  cityLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
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
  bannerText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 10,
    gap: 8,
  },
  loadingText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  dayStrip: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
    flexDirection: "row",
  },
  dayCell: {
    width: 64,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  dayLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  dayDate: { fontSize: 18, fontFamily: "Inter_700Bold" },
  weatherRow: { marginTop: 2 },
  overrideChip: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  overrideText: { fontSize: 9, fontFamily: "Inter_500Medium" },
  content: { flex: 1, paddingHorizontal: 20 },
  locationCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    gap: 12,
    alignItems: "center",
  },
  locationTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  locationBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  locationActions: { flexDirection: "row", gap: 10, width: "100%", marginTop: 4 },
  locationBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  locationBtnLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  locationBtnOutline: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  locationBtnOutlineLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  cityInput: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 80,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  emptyBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  changeCityBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  changeCityText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
