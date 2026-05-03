import AsyncStorage from "@react-native-async-storage/async-storage";
import { Session, User } from "@supabase/supabase-js";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

const ONBOARDING_KEY = "@fitweek/onboarding_complete";
const MODEL_URL_KEY = "@fitweek/model_image_url";

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  hasCompletedOnboarding: boolean;
  modelImageUrl: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: (modelImageUrl: string | null) => Promise<void>;
  pickModelPhoto: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [modelImageUrl, setModelImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (mounted) {
          setSession(data.session);
          setUser(data.session?.user ?? null);
        }
      } catch {
        // Supabase not configured yet — session stays null
      }

      try {
        const [onboarded, storedUrl] = await Promise.all([
          AsyncStorage.getItem(ONBOARDING_KEY),
          AsyncStorage.getItem(MODEL_URL_KEY),
        ]);
        if (mounted) {
          setHasCompletedOnboarding(onboarded === "true");
          setModelImageUrl(storedUrl);
        }
      } catch {
        // AsyncStorage failure — safe to ignore
      }

      if (mounted) setIsLoading(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) {
        setSession(newSession);
        setUser(newSession?.user ?? null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async () => {
    if (!isSupabaseConfigured) {
      throw new Error(
        "Supabase is not configured yet. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your .env file.",
      );
    }

    let redirectTo: string;
    if (Platform.OS === "web") {
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      if (domain) {
        redirectTo = `https://${domain}/fitweek/auth/callback`;
      } else if (typeof window !== "undefined") {
        redirectTo = `${window.location.origin}/fitweek/auth/callback`;
      } else {
        redirectTo = Linking.createURL("/auth/callback");
      }
    } else {
      redirectTo = Linking.createURL("/auth/callback");
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });

    if (error) throw error;
    if (!data.url) throw new Error("No OAuth URL returned from Supabase.");

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (result.type === "success") {
      const url = result.url;
      const hash = url.includes("#") ? url.split("#")[1] : "";
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      }
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore signOut errors
    }
    // Keep ONBOARDING_KEY so returning users skip onboarding on next login.
    // Only clear the model URL so stale Supabase storage links don't linger.
    await AsyncStorage.removeItem(MODEL_URL_KEY);
    setModelImageUrl(null);
  };

  const completeOnboarding = async (url: string | null) => {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    setHasCompletedOnboarding(true);

    if (url) {
      await AsyncStorage.setItem(MODEL_URL_KEY, url);
      setModelImageUrl(url);
    }

    if (isSupabaseConfigured && user && url) {
      try {
        await supabase.from("users").upsert({
          id: user.id,
          model_image_url: url,
        });
      } catch {
        // Non-fatal — local state already updated
      }
    }
  };

  const pickModelPhoto = async (): Promise<string | null> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (result.canceled) return null;
    const uri = result.assets[0]?.uri ?? null;

    if (!uri) return null;

    if (isSupabaseConfigured && user) {
      try {
        const fileName = `model_${user.id}.jpg`;
        const response = await fetch(uri);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const { data, error } = await supabase.storage
          .from("user-models")
          .upload(`models/${user.id}/${fileName}`, arrayBuffer, {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (!error && data) {
          const { data: publicData } = supabase.storage
            .from("user-models")
            .getPublicUrl(data.path);
          return publicData.publicUrl;
        }
      } catch {
        // Fall back to local URI
      }
    }

    return uri;
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        isLoading,
        hasCompletedOnboarding,
        modelImageUrl,
        signIn,
        signOut,
        completeOnboarding,
        pickModelPhoto,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
