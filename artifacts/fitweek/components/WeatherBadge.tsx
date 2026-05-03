import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { DailyForecast, WeatherCondition } from "@/lib/weather";
import { useColors } from "@/hooks/useColors";

const CONDITION_EMOJI: Record<WeatherCondition, string> = {
  clear: "☀️",
  cloudy: "⛅",
  rainy: "🌧",
  snowy: "❄️",
  windy: "💨",
  thunderstorm: "⛈",
};

interface WeatherBadgeProps {
  forecast: DailyForecast;
  size?: "compact" | "full";
}

export function WeatherBadge({ forecast, size = "compact" }: WeatherBadgeProps) {
  const colors = useColors();
  const emoji = CONDITION_EMOJI[forecast.condition];

  if (size === "compact") {
    return (
      <View style={styles.compact}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={[styles.tempCompact, { color: colors.mutedForeground }]}>
          {forecast.tempMax}°
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.full, { backgroundColor: colors.muted }]}>
      <Text style={styles.emojiLarge}>{emoji}</Text>
      <View style={styles.tempRange}>
        <Text style={[styles.tempMax, { color: colors.foreground }]}>
          {forecast.tempMax}°
        </Text>
        <Text style={[styles.tempMin, { color: colors.mutedForeground }]}>
          {forecast.tempMin}°
        </Text>
      </View>
      <Text style={[styles.label, { color: colors.mutedForeground }]} numberOfLines={1}>
        {forecast.conditionLabel}
      </Text>
    </View>
  );
}

export function WeatherUnavailableBadge() {
  const colors = useColors();
  return (
    <View style={styles.compact}>
      <Text style={styles.emoji}>🌫</Text>
      <Text style={[styles.tempCompact, { color: colors.mutedForeground }]}>--°</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  compact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  emoji: { fontSize: 11 },
  emojiLarge: { fontSize: 22 },
  tempCompact: { fontSize: 11, fontFamily: "Poppins_500Medium" },
  full: {
    alignItems: "center",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 2,
  },
  tempRange: { flexDirection: "row", gap: 4, alignItems: "baseline" },
  tempMax: { fontSize: 16, fontFamily: "Poppins_600SemiBold" },
  tempMin: { fontSize: 12, fontFamily: "Poppins_400Regular" },
  label: { fontSize: 10, fontFamily: "Poppins_400Regular", textAlign: "center" },
});
