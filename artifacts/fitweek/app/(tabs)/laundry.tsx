import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Garment, GarmentStatus, useGarments } from "@/contexts/GarmentContext";
import { useColors } from "@/hooks/useColors";

const STATUS_COLOR: Record<GarmentStatus, string> = {
  clean: "#10B981",
  worn: "#64748B",
  laundry: "#0EA5E9",
};

const STATUS_LABEL: Record<GarmentStatus, string> = {
  clean: "Clean",
  worn: "Worn",
  laundry: "In laundry",
};

function LaundryCard({ garment, onMarkClean }: { garment: Garment; onMarkClean: () => void }) {
  const palette = useColors();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.card,
          borderColor: garment.status === "laundry" ? "#0EA5E9" : palette.border,
        },
      ]}
    >
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

      {(garment.status === "laundry" || garment.status === "worn") && (
        <Pressable
          onPress={onMarkClean}
          style={({ pressed }) => [
            styles.cleanBtn,
            { borderColor: palette.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.cleanBtnText, { color: palette.foreground }]}>Mark as clean</Text>
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
        <Text style={[styles.title, { color: palette.foreground }]}>Laundry basket</Text>
        {count > 0 && (
          <View style={[styles.badge, { backgroundColor: palette.statusLaundryBg }]}>
            <Text style={[styles.badgeText, { color: palette.statusLaundry }]}>
              {count} {count === 1 ? "item" : "items"}
            </Text>
          </View>
        )}
      </View>

      {count === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="check-circle" size={48} color={palette.statusClean} />
          <Text style={[styles.emptyTitle, { color: palette.foreground }]}>
            Nothing in the wash
          </Text>
          <Text style={[styles.emptyBody, { color: palette.mutedForeground }]}>
            Your whole wardrobe is ready.
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
  title: { fontSize: 28, fontFamily: "Poppins_700Bold" },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: { fontSize: 12, fontFamily: "Poppins_500Medium" },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 16,
    paddingBottom: 80,
  },
  emptyTitle: { fontSize: 20, fontFamily: "Poppins_600SemiBold", textAlign: "center" },
  emptyBody: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
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
  cardName: { fontSize: 14, fontFamily: "Poppins_500Medium" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontFamily: "Poppins_400Regular" },
  cleanBtn: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cleanBtnText: { fontSize: 12, fontFamily: "Poppins_500Medium" },
});
