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

      {/* Logo */}
      <View style={styles.logoArea}>
        <Image
          source={require("@/assets/images/Logo2.png")}
          style={styles.logoImage}
          contentFit="contain"
          tintColor="#FFFFFF"
        />
      </View>

      {/* Hero image */}
      <View style={styles.heroWrapper}>
        <Image
          source={require("@/assets/images/Hero.png")}
          style={styles.heroImage}
          contentFit="cover"
        />
        {/* Subtle gradient fade at top and bottom so image blends into background */}
        <LinearGradient
          colors={["rgba(139,47,245,0.55)", "transparent"]}
          style={styles.heroFadeTop}
          pointerEvents="none"
        />
        <LinearGradient
          colors={["transparent", "rgba(37,99,235,0.65)"]}
          style={styles.heroFadeBottom}
          pointerEvents="none"
        />
      </View>

      {/* Tagline */}
      <View style={styles.taglineArea}>
        <Text style={styles.tagline}>Your week, already dressed.</Text>
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

  logoArea: {
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 8,
  },
  logoImage: {
    width: 200,
    height: 64,
  },

  heroWrapper: {
    flex: 1,
    marginHorizontal: 24,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
    minHeight: 260,
  },
  heroImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroFadeTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 56,
    zIndex: 1,
  },
  heroFadeBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    zIndex: 1,
  },

  taglineArea: {
    alignItems: "center",
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 4,
    gap: 6,
  },
  tagline: {
    fontSize: 20,
    fontFamily: "Poppins_700Bold",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: 0.1,
  },
  pitch: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    lineHeight: 21,
  },

  bottom: { paddingHorizontal: 24, paddingTop: 20, gap: 14 },
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
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 17,
  },
});
