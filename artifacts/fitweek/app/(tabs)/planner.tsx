import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function PlannerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>This Week</Text>
      </View>

      <View style={styles.dayRow}>
        {DAYS.map((day) => (
          <View key={day} style={[styles.dayPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.dayLabel, { color: colors.mutedForeground }]}>{day}</Text>
          </View>
        ))}
      </View>

      <View style={styles.emptyState}>
        <Feather name="calendar" size={40} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No outfits planned</Text>
        <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
          Add garments to your closet first, then plan your week here.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  dayRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    gap: 6,
    marginBottom: 32,
  },
  dayPill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  dayLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
    paddingBottom: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
});
