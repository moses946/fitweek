import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

interface SettingsRowProps {
  icon: string;
  label: string;
  onPress?: () => void;
  destructive?: boolean;
  testID?: string;
}

function SettingsRow({ icon, label, onPress, destructive, testID }: SettingsRowProps) {
  const colors = useColors();
  const labelColor = destructive ? colors.destructive : colors.foreground;

  return (
    <Pressable
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
      onPress={onPress}
    >
      <Feather name={icon as any} size={18} color={labelColor} />
      <Text style={[styles.rowLabel, { color: labelColor }]}>{label}</Text>
      {!destructive && (
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      )}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/sign-in");
        },
      },
    ]);
  };

  const displayName = user?.user_metadata?.["full_name"] ?? user?.email ?? "Your account";
  const email = user?.email ?? "";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Platform.OS === "web" ? 67 : insets.top + 8,
          paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 24,
        },
      ]}
    >
      <Text style={[styles.screenTitle, { color: colors.foreground }]}>Profile</Text>

      <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
          <Text style={[styles.avatarInitials, { color: colors.card }]}>{initials || "?"}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: colors.foreground }]}>{displayName}</Text>
          {!!email && (
            <Text style={[styles.profileEmail, { color: colors.mutedForeground }]}>{email}</Text>
          )}
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <SettingsRow
          icon="user"
          label="Update model photo"
          onPress={() => router.push("/(onboarding)/model-photo")}
          testID="update-model-photo"
        />
        <SettingsRow
          icon="map-pin"
          label="Change location"
          testID="change-location"
        />
        <SettingsRow
          icon="bell"
          label="Notifications"
          testID="notifications"
        />
      </View>

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <SettingsRow
          icon="log-out"
          label="Sign out"
          onPress={handleSignOut}
          destructive
          testID="sign-out-button"
        />
      </View>

      <Text style={[styles.version, { color: colors.mutedForeground }]}>FitWeek v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16 },
  screenTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  profileEmail: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  version: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
  },
});
