import { AntDesign, Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
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
import { isSupabaseConfigured } from "@/lib/supabase";
import colors from "@/constants/colors";

export default function SignInScreen() {
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

  const FEATURES = [
    { icon: "camera" as const, label: "Photograph" },
    { icon: "sun" as const, label: "Weather" },
    { icon: "calendar" as const, label: "Plan" },
  ];

  return (
    <LinearGradient
      colors={colors.gradientPrimary}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.container,
        {
          paddingTop: Platform.OS === "web" ? 67 : insets.top,
          paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 24,
        },
      ]}
    >
      {!isSupabaseConfigured && (
        <View style={styles.banner}>
          <Feather name="alert-circle" size={13} color="rgba(255,255,255,0.8)" />
          <Text style={styles.bannerText}>
            Add Supabase credentials to .env to enable sign-in
          </Text>
        </View>
      )}

      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoArea}>
          <Image
            source={require("@/assets/images/Logo2.png")}
            style={styles.logoImage}
            contentFit="contain"
            tintColor="#FFFFFF"
          />
          <Text style={styles.tagline}>Your wardrobe. Planned.</Text>
        </View>

        {/* Feature cards */}
        <View style={styles.featureRow}>
          {FEATURES.map(({ icon, label }) => (
            <View key={label} style={styles.featureCard}>
              <Feather name={icon} size={22} color="#FFFFFF" />
              <Text style={styles.featureLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.pitch}>
          {"Only shows what's actually "}
          <Text style={{ fontFamily: "Poppins_600SemiBold" }}>clean</Text>
          {" and right for the "}
          <Text style={{ fontFamily: "Poppins_600SemiBold" }}>weather</Text>.
        </Text>
      </View>

      {/* CTA */}
      <View style={styles.bottom}>
        <Pressable
          testID="google-sign-in-button"
          onPress={handleGoogleSignIn}
          disabled={isLoading}
          style={({ pressed }) => [styles.ctaButton, { opacity: pressed ? 0.9 : 1 }]}
        >
          {isLoading ? (
            <ActivityIndicator color="#1A1F36" />
          ) : (
            <View style={styles.ctaInner}>
              <AntDesign name="google" size={18} color="#1A1F36" />
              <Text style={styles.ctaLabel}>Continue with Google</Text>
            </View>
          )}
        </Pressable>
        <Text style={styles.legal}>
          By continuing you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>
    </LinearGradient>
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
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(255,255,255,0.15)",
    gap: 8,
  },
  bannerText: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.9)",
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 36,
  },
  logoArea: { alignItems: "center", gap: 14 },
  logoImage: {
    width: 240,
    height: 80,
  },
  tagline: {
    fontSize: 16,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 0.2,
  },
  featureRow: { flexDirection: "row", gap: 12 },
  featureCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(255,255,255,0.15)",
    gap: 8,
  },
  featureLabel: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    color: "rgba(255,255,255,0.9)",
  },
  pitch: {
    fontSize: 15,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    lineHeight: 22,
  },
  bottom: { paddingHorizontal: 24, gap: 16 },
  ctaButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ctaLabel: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: "#1A1F36",
  },
  legal: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    lineHeight: 17,
  },
});
