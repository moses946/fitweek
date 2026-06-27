import { AntDesign, Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
import colors from "@/constants/colors";
import { ErrorBanner } from "@/components/ErrorBanner";

const signUpSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export default function SignUpScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUpWithEmail } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSignUp = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    
    const parsed = signUpSchema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      setErrorMsg(parsed.error.errors[0].message);
      return;
    }

    setIsLoading(true);
    try {
      await signUpWithEmail(parsed.data.email, parsed.data.password);
      setSuccessMsg("Account created! If email confirmation is enabled, check your inbox. Otherwise, you can now sign in.");
      // We don't automatically redirect in case they need to verify email first.
      // If auto-login happens, AuthGate will handle the redirect.
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create account.");
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
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
          <Feather name="chevron-left" size={28} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Create an account</Text>
        <Text style={styles.subtitle}>Join Fitweek to plan your outfits.</Text>

        <ErrorBanner message={errorMsg} onDismiss={() => setErrorMsg(null)} type="error" />
        <ErrorBanner message={successMsg} onDismiss={() => setSuccessMsg(null)} type="success" />

        <View style={styles.form}>
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
            autoComplete="new-password"
            editable={!isLoading}
          />

          <Pressable
            onPress={handleSignUp}
            disabled={isLoading}
            style={({ pressed }) => [styles.ctaButton, { opacity: pressed ? 0.9 : 1 }]}
          >
            {isLoading ? (
              <ActivityIndicator color="#1A1F36" />
            ) : (
              <Text style={styles.ctaLabel}>Sign up</Text>
            )}
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 32,
    fontFamily: "Poppins_700Bold",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.8)",
    marginBottom: 32,
  },
  form: { gap: 14 },
  input: {
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    color: "#FFFFFF",
    fontFamily: "Poppins_400Regular",
    fontSize: 15,
  },
  ctaButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  ctaLabel: {
    fontSize: 15,
    fontFamily: "Poppins_600SemiBold",
    color: "#1A1F36",
  },
});
