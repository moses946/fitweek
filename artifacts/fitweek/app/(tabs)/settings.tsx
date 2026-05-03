import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import brandColors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useWeather } from "@/contexts/WeatherContext";
import { useColors } from "@/hooks/useColors";
import { scheduleSundayPlannerNotification } from "@/lib/outfitSlotNotifications";

interface SettingsRowProps {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  testID?: string;
}

function SettingsRow({ icon, label, value, onPress, destructive, testID }: SettingsRowProps) {
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
      {value ? (
        <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{value}</Text>
      ) : null}
      {!destructive && (
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      )}
    </Pressable>
  );
}

function LocationModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const { requestLocationAndFetch, setCity, city } = useWeather();
  const [mode, setMode] = useState<"menu" | "city">("menu");
  const [cityInput, setCityInput] = useState(city ?? "");

  useEffect(() => {
    if (visible) { setMode("menu"); setCityInput(city ?? ""); }
  }, [visible]);

  const handleGPS = async () => {
    onClose();
    await requestLocationAndFetch();
  };

  const handleCitySubmit = async () => {
    const trimmed = cityInput.trim();
    if (!trimmed) return;
    onClose();
    await setCity(trimmed);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.card }]}>
        <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
        <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Change location</Text>
        <Text style={[styles.sheetBody, { color: colors.mutedForeground }]}>
          FitWeek uses your location to show weather-appropriate outfit suggestions.
        </Text>

        {mode === "menu" ? (
          <View style={styles.sheetActions}>
            <Pressable onPress={handleGPS} style={{ flex: 1 }}>
              <LinearGradient
                colors={brandColors.gradientPrimary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sheetBtn}
              >
                <Feather name="navigation" size={15} color="#FFF" />
                <Text style={styles.sheetBtnLabel}>Use GPS</Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              style={[styles.sheetBtnOutline, { borderColor: colors.border, flex: 1 }]}
              onPress={() => setMode("city")}
            >
              <Text style={[styles.sheetBtnOutlineLabel, { color: colors.foreground }]}>
                Enter city
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.citySection}>
            <TextInput
              style={[styles.cityInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="e.g. London, Tokyo, New York"
              placeholderTextColor={colors.mutedForeground}
              value={cityInput}
              onChangeText={setCityInput}
              onSubmitEditing={handleCitySubmit}
              returnKeyType="done"
              autoFocus
            />
            <View style={styles.sheetActions}>
              <Pressable onPress={handleCitySubmit} style={{ flex: 1 }}>
                <LinearGradient
                  colors={brandColors.gradientPrimary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.sheetBtn}
                >
                  <Text style={styles.sheetBtnLabel}>Confirm</Text>
                </LinearGradient>
              </Pressable>
              <Pressable
                style={[styles.sheetBtnOutline, { borderColor: colors.border, flex: 1 }]}
                onPress={() => setMode("menu")}
              >
                <Text style={[styles.sheetBtnOutlineLabel, { color: colors.foreground }]}>Back</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

function NotificationsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const [enabled, setEnabled] = useState(false);
  const [permDenied, setPermDenied] = useState(false);

  useEffect(() => {
    if (!visible) return;
    Notifications.getPermissionsAsync().then(({ status }) => {
      setPermDenied(status === "denied");
    });
    Notifications.getAllScheduledNotificationsAsync().then((all) => {
      setEnabled(all.some((n) => n.content.title === "Plan your week"));
    });
  }, [visible]);

  const handleToggle = async (value: boolean) => {
    if (value) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        setPermDenied(true);
        Alert.alert(
          "Permission needed",
          "Enable notifications in your device settings to receive outfit reminders.",
        );
        return;
      }
      setPermDenied(false);
      await scheduleSundayPlannerNotification();
      setEnabled(true);
    } else {
      const all = await Notifications.getAllScheduledNotificationsAsync();
      await Promise.all(
        all
          .filter((n) => n.content.title === "Plan your week")
          .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
      );
      setEnabled(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.card }]}>
        <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
        <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Notifications</Text>

        <View style={[styles.notifRow, { borderColor: colors.border }]}>
          <View style={styles.notifInfo}>
            <Text style={[styles.notifLabel, { color: colors.foreground }]}>
              Weekly planner reminder
            </Text>
            <Text style={[styles.notifSub, { color: colors.mutedForeground }]}>
              Sunday at 7 pm — time to plan next week
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={handleToggle}
            trackColor={{ true: brandColors.light.primary }}
          />
        </View>

        {permDenied && (
          <Text style={[styles.permNote, { color: colors.mutedForeground }]}>
            Notification permission is denied. Enable it in your device Settings app.
          </Text>
        )}

        <Pressable onPress={onClose} style={[styles.sheetCloseBtn, { borderColor: colors.border }]}>
          <Text style={[styles.sheetCloseBtnLabel, { color: colors.foreground }]}>Done</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function parseDateString(s: string | null): Date {
  if (!s) return new Date(1990, 0, 1);
  // Try ISO string first
  const iso = new Date(s);
  if (!isNaN(iso.getTime())) return iso;
  // Try "DD Month YYYY" e.g. "15 March 1995"
  const parts = s.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (parts) {
    const parsed = new Date(`${parts[2]} ${parts[1]}, ${parts[3]}`);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date(1990, 0, 1);
}

function formatBirthdate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function BirthdayModal({
  visible,
  current,
  onClose,
  onSave,
}: {
  visible: boolean;
  current: string | null;
  onClose: () => void;
  onSave: (value: string) => void;
}) {
  const colors = useColors();
  const [selectedDate, setSelectedDate] = useState<Date>(() => parseDateString(current));

  useEffect(() => {
    if (visible) setSelectedDate(parseDateString(current));
  }, [visible, current]);

  const handleChange = (_: DateTimePickerEvent, date?: Date) => {
    if (date) setSelectedDate(date);
  };

  const handleSave = () => {
    onSave(formatBirthdate(selectedDate));
    onClose();
  };

  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() - 5);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.card }]}>
        <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
        <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Date of birth</Text>
        <Text style={[styles.sheetBody, { color: colors.mutedForeground }]}>
          Google doesn't share your birthdate — enter it here so FitWeek can personalise seasonal suggestions.
        </Text>

        {Platform.OS === "web" ? (
          <TextInput
            style={[styles.cityInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            placeholder="e.g. 15 March 1995"
            placeholderTextColor={colors.mutedForeground}
            value={formatBirthdate(selectedDate)}
            onChangeText={(text) => {
              const d = parseDateString(text);
              if (!isNaN(d.getTime())) setSelectedDate(d);
            }}
            returnKeyType="done"
          />
        ) : (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="spinner"
            onChange={handleChange}
            maximumDate={maxDate}
            minimumDate={new Date(1900, 0, 1)}
            textColor={colors.foreground}
            themeVariant="light"
            style={styles.datePicker}
          />
        )}

        <View style={styles.sheetActions}>
          <Pressable onPress={handleSave} style={{ flex: 1 }}>
            <LinearGradient
              colors={brandColors.gradientPrimary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sheetBtn}
            >
              <Text style={styles.sheetBtnLabel}>Save</Text>
            </LinearGradient>
          </Pressable>
          <Pressable
            style={[styles.sheetBtnOutline, { borderColor: colors.border, flex: 1 }]}
            onPress={onClose}
          >
            <Text style={[styles.sheetBtnOutlineLabel, { color: colors.foreground }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, userProfile, signOut, updateBirthdate } = useAuth();
  const router = useRouter();

  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [birthdayModalVisible, setBirthdayModalVisible] = useState(false);

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

  const displayName =
    userProfile?.name ??
    user?.user_metadata?.["full_name"] ??
    user?.user_metadata?.["name"] ??
    user?.email ??
    "Your account";
  const email = userProfile?.email ?? user?.email ?? "";
  const avatarUrl = userProfile?.avatarUrl ?? user?.user_metadata?.["avatar_url"] ?? null;
  const birthdate = userProfile?.birthdate ?? null;

  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <LocationModal visible={locationModalVisible} onClose={() => setLocationModalVisible(false)} />
      <NotificationsModal visible={notifModalVisible} onClose={() => setNotifModalVisible(false)} />
      <BirthdayModal
        visible={birthdayModalVisible}
        current={birthdate}
        onClose={() => setBirthdayModalVisible(false)}
        onSave={updateBirthdate}
      />

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
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} contentFit="cover" />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.accent }]}>
              <Text style={[styles.avatarInitials, { color: colors.card }]}>{initials || "?"}</Text>
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.foreground }]}>{displayName}</Text>
            {!!email && (
              <Text style={[styles.profileEmail, { color: colors.mutedForeground }]}>{email}</Text>
            )}
            {!!birthdate && (
              <Text style={[styles.profileBirthdate, { color: colors.mutedForeground }]}>
                🎂 {birthdate}
              </Text>
            )}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingsRow
            icon="user"
            label="Update model photo"
            onPress={() => router.push("/(onboarding)/model-photo?mode=update")}
            testID="update-model-photo"
          />
          <SettingsRow
            icon="gift"
            label="Date of birth"
            value={birthdate ?? "Not set"}
            onPress={() => setBirthdayModalVisible(true)}
            testID="date-of-birth"
          />
          <SettingsRow
            icon="map-pin"
            label="Change location"
            onPress={() => setLocationModalVisible(true)}
            testID="change-location"
          />
          <SettingsRow
            icon="bell"
            label="Notifications"
            onPress={() => setNotifModalVisible(true)}
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
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16 },
  screenTitle: {
    fontSize: 28,
    fontFamily: "Poppins_700Bold",
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
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: { fontSize: 20, fontFamily: "Poppins_700Bold" },
  profileInfo: { flex: 1, gap: 2 },
  profileName: { fontSize: 16, fontFamily: "Poppins_600SemiBold" },
  profileEmail: { fontSize: 13, fontFamily: "Poppins_400Regular" },
  profileBirthdate: { fontSize: 12, fontFamily: "Poppins_400Regular", marginTop: 2 },
  section: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: "Poppins_400Regular" },
  rowValue: { fontSize: 13, fontFamily: "Poppins_400Regular" },
  version: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    marginTop: 8,
  },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(26,31,54,0.40)" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  sheetHandle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 4,
  },
  sheetTitle: { fontSize: 18, fontFamily: "Poppins_700Bold" },
  sheetBody: { fontSize: 14, fontFamily: "Poppins_400Regular", lineHeight: 20 },
  sheetActions: { flexDirection: "row", gap: 10 },
  sheetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 12,
    gap: 6,
  },
  sheetBtnLabel: { color: "#FFF", fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  sheetBtnOutline: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  sheetBtnOutlineLabel: { fontSize: 14, fontFamily: "Poppins_500Medium" },
  citySection: { gap: 12 },
  cityInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Poppins_400Regular",
  },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  notifInfo: { flex: 1 },
  notifLabel: { fontSize: 15, fontFamily: "Poppins_500Medium" },
  notifSub: { fontSize: 12, fontFamily: "Poppins_400Regular", marginTop: 2 },
  permNote: { fontSize: 12, fontFamily: "Poppins_400Regular", lineHeight: 18 },
  sheetCloseBtn: {
    alignItems: "center",
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  sheetCloseBtnLabel: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  datePicker: { width: "100%" as const, height: 200 },
});
