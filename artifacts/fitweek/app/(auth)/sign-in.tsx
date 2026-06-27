import { AntDesign, Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { z } from "zod";

import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import { API_BASE_URL, PRIVACY_POLICY_URL, TERMS_URL } from "@/lib/config";
import colors from "@/constants/colors";
import { ErrorBanner } from "@/components/ErrorBanner";

const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(1, "Please enter your password."),
});

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn, signInWithEmail } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    if (!isSupabaseConfigured) {
      setErrorMsg("Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your .env file to enable sign-in.");
      return;
    }
    setErrorMsg(null);
    setIsLoading(true);
    try {
      await signIn();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignIn = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const parsed = signInSchema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      setErrorMsg(parsed.error.errors[0].message);
      return;
    }

    setIsLoading(true);
    try {
      await signInWithEmail(parsed.data.email, parsed.data.password);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Invalid email or password.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    
    if (!email.trim() || !z.string().email().safeParse(email.trim()).success) {
      setErrorMsg("Please enter a valid email address first to reset your password.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      
      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to request password reset.");
      }
      
      setSuccessMsg(data.message || "Password reset link sent. Check your inbox.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
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
      {/* Dev-only banner - hidden in production if configured */}
      {__DEV__ && !isSupabaseConfigured && (
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
      </View>

      {/* CTA */}
      <View style={styles.bottom}>
        <ErrorBanner message={errorMsg} onDismiss={() => setErrorMsg(null)} type="error" />
        <ErrorBanner message={successMsg} onDismiss={() => setSuccessMsg(null)} type="success" />

        {showEmailForm ? (
          <View style={styles.emailForm}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              editable={!isLoading}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              editable={!isLoading}
            />
            
            <View style={styles.forgotPasswordRow}>
              <Pressable onPress={handleForgotPassword} disabled={isLoading} hitSlop={8}>
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={handleEmailSignIn}
              disabled={isLoading}
              style={({ pressed }) => [styles.ctaButton, { opacity: pressed ? 0.9 : 1 }]}
            >
              {isLoading ? (
                <ActivityIndicator color="#1A1F36" />
              ) : (
                <Text style={styles.ctaLabel}>Sign in</Text>
              )}
            </Pressable>
            
            <Pressable 
              onPress={() => router.push("/(auth)/sign-up")} 
              disabled={isLoading}
              style={styles.signUpLink}
              hitSlop={8}
            >
              <Text style={styles.signUpText}>Don't have an account? <Text style={styles.signUpTextBold}>Sign up</Text></Text>
            </Pressable>

            <Pressable onPress={() => { setShowEmailForm(false); setErrorMsg(null); setSuccessMsg(null); }} disabled={isLoading} style={styles.backButton}>
              <Feather name="chevron-left" size={16} color="rgba(255,255,255,0.85)" />
              <Text style={styles.toggleText}>Back to Google sign-in</Text>
            </Pressable>
          </View>
        ) : (
          <>
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
            
            <Pressable onPress={() => { setShowEmailForm(true); setErrorMsg(null); setSuccessMsg(null); }} disabled={isLoading}>
              <Text style={styles.toggleText}>Use email & password instead</Text>
            </Pressable>
            
            <Pressable 
              onPress={() => router.push("/(auth)/sign-up")} 
              disabled={isLoading}
              hitSlop={8}
            >
              <Text style={styles.signUpText}>Don't have an account? <Text style={styles.signUpTextBold}>Sign up</Text></Text>
            </Pressable>
          </>
        )}
        <Text style={styles.legal}>
          By continuing you agree to our{" "}
          {TERMS_URL ? (
            <Text
              style={styles.legalLink}
              onPress={() => Linking.openURL(TERMS_URL)}
            >
              Terms of Service
            </Text>
          ) : (
            "Terms of Service"
          )}{" "}
          and{" "}
          {PRIVACY_POLICY_URL ? (
            <Text
              style={styles.legalLink}
              onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
            >
              Privacy Policy
            </Text>
          ) : (
            "Privacy Policy"
          )}
          .
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
    fontFamily: "Poppins_500Medium",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: 0.1,
  },

  bottom: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 10, gap: 14 },
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
  emailForm: { gap: 10 },
  input: {
    height: 48,
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    color: "#FFFFFF",
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
  },
  forgotPasswordRow: {
    alignItems: "flex-end",
    marginTop: -4,
    marginBottom: 4,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontFamily: "Poppins_500Medium",
    color: "rgba(255,255,255,0.9)",
  },
  signUpLink: {
    alignItems: "center",
    marginVertical: 4,
  },
  signUpText: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.8)",
  },
  signUpTextBold: {
    fontFamily: "Poppins_600SemiBold",
    color: "#FFFFFF",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
  },
  toggleText: {
    fontSize: 13,
    fontFamily: "Poppins_500Medium",
    color: "rgba(255,255,255,0.85)",
  },
  legal: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 17,
  },
  legalLink: {
    textDecorationLine: "underline",
    color: "rgba(255,255,255,0.85)",
  },
});
