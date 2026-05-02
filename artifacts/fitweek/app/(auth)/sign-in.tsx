import { AntDesign, Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function SignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    if (!isSupabaseConfigured) {
      Alert.alert(
        "Setup required",
        "Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your .env file to enable sign-in.",
      );
      return;
    }

    setIsLoading(true);
    try {
      await signIn();
    } catch (err) {
      Alert.alert(
        "Sign-in failed",
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: Platform.OS === "web" ? 67 : insets.top,
          paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 24,
        },
      ]}
    >
      {!isSupabaseConfigured && (
        <View
          style={[
            styles.banner,
            { backgroundColor: colors.accent + "25", borderColor: colors.border },
          ]}
        >
          <Feather name="alert-circle" size={13} color={colors.accent} />
          <Text style={[styles.bannerText, { color: colors.foreground }]}>
            Add Supabase credentials to .env to enable sign-in
          </Text>
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.logoArea}>
          <Text style={[styles.wordmark, { color: colors.foreground }]}>FitWeek</Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            Your wardrobe. Planned.
          </Text>
        </View>

        <View style={styles.featureRow}>
          <View
            style={[
              styles.featureCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="camera" size={22} color={colors.accent} />
            <Text style={[styles.featureLabel, { color: colors.mutedForeground }]}>
              Photograph
            </Text>
          </View>
          <View
            style={[
              styles.featureCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="sun" size={22} color={colors.accent} />
            <Text style={[styles.featureLabel, { color: colors.mutedForeground }]}>
              Weather
            </Text>
          </View>
          <View
            style={[
              styles.featureCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="calendar" size={22} color={colors.accent} />
            <Text style={[styles.featureLabel, { color: colors.mutedForeground }]}>
              Plan
            </Text>
          </View>
        </View>

        <Text style={[styles.pitch, { color: colors.mutedForeground }]}>
          {"Only shows what's actually "}
          <Text style={{ color: colors.statusClean, fontFamily: "Inter_600SemiBold" }}>
            clean
          </Text>
          {" and right for the "}
          <Text style={{ color: colors.accent, fontFamily: "Inter_600SemiBold" }}>
            weather
          </Text>
          .
        </Text>
      </View>

      <View style={styles.bottom}>
        <Pressable
          testID="google-sign-in-button"
          style={({ pressed }) => [
            styles.googleButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 },
          ]}
          onPress={handleGoogleSignIn}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <AntDesign name="google" size={18} color={colors.primaryForeground} />
              <Text style={[styles.googleButtonText, { color: colors.primaryForeground }]}>
                Continue with Google
              </Text>
            </>
          )}
        </Pressable>

        <Text style={[styles.legal, { color: colors.mutedForeground }]}>
          By continuing you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  bannerText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 36,
  },
  logoArea: { alignItems: "center", gap: 8 },
  wordmark: {
    fontSize: 44,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1.5,
  },
  tagline: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.2,
  },
  featureRow: {
    flexDirection: "row",
    gap: 12,
  },
  featureCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 18,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  featureLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  pitch: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  bottom: {
    paddingHorizontal: 24,
    gap: 16,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    borderRadius: 14,
    gap: 10,
  },
  googleButtonText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  legal: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 17,
  },
});
