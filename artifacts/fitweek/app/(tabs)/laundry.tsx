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

import { Garment, useGarments } from "@/contexts/GarmentContext";
import { useColors } from "@/hooks/useColors";

const STATUS_COLOR = { clean: "#34C759", worn: "#FF9500", laundry: "#FF3B30" };
const STATUS_LABEL = { clean: "Clean", worn: "Worn", laundry: "In laundry" };

function LaundryCard({ garment, onMarkClean }: { garment: Garment; onMarkClean: () => void }) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Image source={{ uri: garment.imageUri }} style={styles.cardImage} contentFit="cover" />
      <View style={styles.cardBody}>
        <Text style={[styles.cardName, { color: colors.foreground }]} numberOfLines={1}>
          {garment.name}
        </Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[garment.status] }]} />
          <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
            {STATUS_LABEL[garment.status]}
          </Text>
        </View>
      </View>
      {garment.status === "laundry" && (
        <Pressable
          style={[styles.cleanBtn, { borderColor: STATUS_COLOR.clean }]}
          onPress={onMarkClean}
        >
          <Text style={[styles.cleanBtnText, { color: STATUS_COLOR.clean }]}>Mark clean</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function LaundryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { garments, markClean } = useGarments();

  const dirty = garments.filter((g) => g.status === "worn" || g.status === "laundry");
  const count = dirty.length;

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
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Laundry</Text>
        <View style={[styles.badge, { backgroundColor: colors.muted }]}>
          <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>
            {count} {count === 1 ? "item" : "items"}
          </Text>
        </View>
      </View>

      {count === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="check-circle" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>All clean</Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
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
    gap: 12,
    paddingBottom: 80,
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
    borderRadius: 14,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  cleanBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
