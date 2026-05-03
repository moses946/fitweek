import AsyncStorage from "@react-native-async-storage/async-storage";
import { Session, User } from "@supabase/supabase-js";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

// Keys are per-user so a new account on the same device starts fresh.
function onboardingKey(userId: string | undefined) {
  return userId
    ? `@fitweek/onboarding_complete/${userId}`
    : "@fitweek/onboarding_complete";
}
function modelUrlKey(userId: string | undefined) {
  return userId
    ? `@fitweek/model_image_url/${userId}`
    : "@fitweek/model_image_url";
}

export interface UserProfile {
  name: string | null;
  avatarUrl: string | null;
  email: string | null;
  birthdate: string | null;
}

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  hasCompletedOnboarding: boolean;
  modelImageUrl: string | null;
  userProfile: UserProfile | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: (modelImageUrl: string | null) => Promise<void>;
  pickModelPhoto: () => Promise<string | null>;
  updateBirthdate: (birthdate: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [modelImageUrl, setModelImageUrl] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  /**
   * Push the user's Google identity (name, avatar, email) into the users table.
   * Called on every login so the server-side record stays fresh.
   * Requires the users table to have columns: full_name, avatar_url, email.
   */
  const syncGoogleProfile = async (u: User) => {
    if (!isSupabaseConfigured) return;
    const meta = u.user_metadata ?? {};
    try {
      await supabase.from("users").upsert(
        {
          id: u.id,
          full_name: meta["full_name"] ?? meta["name"] ?? null,
          avatar_url: meta["avatar_url"] ?? meta["picture"] ?? null,
          email: u.email ?? null,
        },
        { onConflict: "id" },
      );
    } catch {
      // Non-fatal — columns may not exist yet in the schema.
    }
  };

  /**
   * Load per-user data: onboarding flag, model URL, and full profile from Supabase.
   * Checks local cache first; falls back to Supabase for new devices.
   */
  const loadUserData = async (userId: string | undefined) => {
    try {
      const [onboarded, storedModelUrl] = await Promise.all([
        AsyncStorage.getItem(onboardingKey(userId)),
        AsyncStorage.getItem(modelUrlKey(userId)),
      ]);
      setHasCompletedOnboarding(onboarded === "true");

      if (storedModelUrl) {
        setModelImageUrl(storedModelUrl);
      } else if (userId && isSupabaseConfigured) {
        // No local cache (e.g. new device) — fetch model URL from Supabase.
        try {
          const { data } = await supabase
            .from("users")
            .select("model_image_url")
            .eq("id", userId)
            .single();
          const remoteUrl: string | null = data?.model_image_url ?? null;
          if (remoteUrl) {
            await AsyncStorage.setItem(modelUrlKey(userId), remoteUrl);
            setModelImageUrl(remoteUrl);
          }
        } catch {
          // Non-fatal
        }
      }

      // Fetch full profile (name, avatar, email, birthdate) from Supabase.
      if (userId && isSupabaseConfigured) {
        try {
          const { data } = await supabase
            .from("users")
            .select("full_name, avatar_url, email, birthdate")
            .eq("id", userId)
            .single();
          if (data) {
            setUserProfile({
              name: data.full_name ?? null,
              avatarUrl: data.avatar_url ?? null,
              email: data.email ?? null,
              birthdate: data.birthdate ?? null,
            });
          }
        } catch {
          // Non-fatal — profile stays null; Settings will fall back to user_metadata.
        }
      }
    } catch {
      // AsyncStorage failure — safe to ignore
    }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      let currentUser: User | undefined;

      try {
        const { data } = await supabase.auth.getSession();
        if (mounted) {
          setSession(data.session);
          setUser(data.session?.user ?? null);
          currentUser = data.session?.user;
        }
      } catch {
        // Supabase not configured yet — session stays null
      }

      if (mounted) {
        await loadUserData(currentUser?.id);
        setIsLoading(false);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      const newUser = newSession?.user;
      if (newUser) {
        // Sync Google profile data to Supabase on every login (fire and forget).
        syncGoogleProfile(newUser);
      } else {
        // Signed out — clear profile from memory.
        setUserProfile(null);
      }
      // Reload per-user data (model URL, birthdate, onboarding flag).
      loadUserData(newUser?.id);
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
    const currentUserId = user?.id;

    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore signOut errors
    }

    // Clear this user's model URL (can become stale after session ends).
    // Onboarding flag is kept — same account skips onboarding on next login.
    // New accounts have their own per-user key so they still see onboarding.
    if (currentUserId) {
      await AsyncStorage.removeItem(modelUrlKey(currentUserId));
    }

    setModelImageUrl(null);
    setHasCompletedOnboarding(false);
    setUserProfile(null);
  };

  const completeOnboarding = async (url: string | null) => {
    const userId = user?.id;

    await AsyncStorage.setItem(onboardingKey(userId), "true");
    setHasCompletedOnboarding(true);

    if (url) {
      await AsyncStorage.setItem(modelUrlKey(userId), url);
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

  const updateBirthdate = async (birthdate: string) => {
    setUserProfile((prev) =>
      prev ? { ...prev, birthdate } : { name: null, avatarUrl: null, email: null, birthdate },
    );

    if (isSupabaseConfigured && user) {
      try {
        await supabase.from("users").upsert(
          { id: user.id, birthdate },
          { onConflict: "id" },
        );
      } catch {
        // Non-fatal
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
        userProfile,
        signIn,
        signOut,
        completeOnboarding,
        pickModelPhoto,
        updateBirthdate,
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
