import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import colors from "@/constants/colors";
import { Garment, GarmentStatus, useGarments } from "@/contexts/GarmentContext";
import { useColors } from "@/hooks/useColors";

// Brand status colors
const STATUS_COLOR: Record<GarmentStatus, string> = {
  clean: "#22C55E",
  worn: "#64748B",
  laundry: "#F97316",
};

const STATUS_LABEL: Record<GarmentStatus, string> = {
  clean: "Clean",
  worn: "Worn",
  laundry: "In laundry",
};

function LaundryCard({ garment, onMarkClean }: { garment: Garment; onMarkClean: () => void }) {
  const palette = useColors();
  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <Image source={{ uri: garment.imageUri }} style={styles.cardImage} contentFit="cover" />
      <View style={styles.cardBody}>
        <Text style={[styles.cardName, { color: palette.foreground }]} numberOfLines={1}>
          {garment.name}
        </Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[garment.status] }]} />
          <Text style={[styles.statusText, { color: palette.mutedForeground }]}>
            {STATUS_LABEL[garment.status]}
          </Text>
        </View>
      </View>

      {garment.status === "laundry" && (
        <Pressable onPress={onMarkClean}>
          <LinearGradient
            colors={colors.gradientPrimary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cleanBtn}
          >
            <Feather name="check" size={13} color="#FFFFFF" />
            <Text style={styles.cleanBtnText}>Clean</Text>
          </LinearGradient>
        </Pressable>
      )}

      {garment.status === "worn" && (
        <Pressable onPress={onMarkClean}>
          <View style={[styles.wornBtn, { borderColor: palette.border }]}>
            <Text style={[styles.wornBtnText, { color: palette.mutedForeground }]}>
              Mark clean
            </Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

export default function LaundryScreen() {
  const palette = useColors();
  const insets = useSafeAreaInsets();
  const { garments, markClean } = useGarments();

  const dirty = garments.filter((g) => g.status === "worn" || g.status === "laundry");
  const count = dirty.length;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: palette.background,
          paddingTop: Platform.OS === "web" ? 67 : insets.top,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.foreground }]}>Laundry</Text>
        <View style={[styles.badge, { backgroundColor: palette.muted }]}>
          <Text style={[styles.badgeText, { color: palette.mutedForeground }]}>
            {count} {count === 1 ? "item" : "items"}
          </Text>
        </View>
      </View>

      {count === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconWrap, { backgroundColor: palette.muted }]}>
            <Feather name="check-circle" size={32} color={palette.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: palette.foreground }]}>All clean</Text>
          <Text style={[styles.emptyBody, { color: palette.mutedForeground }]}>
            Items you mark as worn or sent to laundry will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={dirty}
          keyExtractor={(g) => g.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 80 },
          ]}
          renderItem={({ item }) => (
            <LaundryCard garment={item} onMarkClean={() => markClean(item.id)} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 10,
  },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 16,
    paddingBottom: 80,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  emptyBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  list: { paddingHorizontal: 16, paddingTop: 4, gap: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    gap: 12,
    paddingRight: 14,
  },
  cardImage: { width: 64, height: 64 },
  cardBody: { flex: 1, gap: 4 },
  cardName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  cleanBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  cleanBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  wornBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  wornBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
