import { Session, User } from "@supabase/supabase-js";
import { AuthAdapter, UserProfile } from "./authStore";
import { API_BASE_URL } from "./config";
import { isSupabaseConfigured, supabase } from "./supabase";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

/**
 * apiRequest — thin wrapper for authenticated API calls.
 *
 * Always pulls the current session token from supabase.auth.getSession()
 * so callers don't need to thread the token through every function.
 */
async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `API error ${res.status}`,
    );
  }

  return res.json() as Promise<T>;
}

export const SupabaseAuthAdapter: AuthAdapter = {
  isConfigured: () => isSupabaseConfigured,

  async getSession() {
    try {
      const { data } = await supabase.auth.getSession();
      return { session: data.session, user: data.session?.user ?? null };
    } catch {
      return { session: null, user: null };
    }
  },

  async signIn() {
    if (!isSupabaseConfigured) throw new Error("Supabase not configured");

    let redirectTo: string;
    if (Platform.OS === "web") {
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      if (domain) {
        redirectTo = `https://${domain}/auth/callback`;
      } else if (typeof window !== "undefined") {
        redirectTo = `${window.location.origin}/auth/callback`;
      } else {
        redirectTo = Linking.createURL("/auth/callback");
      }
    } else {
      const hostUri = Constants.expoConfig?.hostUri;
      redirectTo = hostUri
        ? `exp://${hostUri}/--/auth/callback`
        : Linking.createURL("/auth/callback");
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });

    if (error) throw error;
    if (!data.url) throw new Error("No OAuth URL returned");

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== "success") return;

    const url = result.url;
    const hashStr = url.includes("#") ? url.split("#")[1] : "";
    const queryStr = url.includes("?") ? url.split("?")[1]?.split("#")[0] : "";
    const hashParams = new URLSearchParams(hashStr);
    const queryParams = new URLSearchParams(queryStr ?? "");

    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const code = queryParams.get("code");

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
    } else if (accessToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: "",
      });
      if (error) {
        await supabase.auth.refreshSession();
      }
    }
  },

  async signInWithEmail(email, password) {
    if (!isSupabaseConfigured) throw new Error("Supabase not configured");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  async signUpWithEmail(email, password) {
    if (!isSupabaseConfigured) throw new Error("Supabase not configured");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  /**
   * getProfile — fetches the profiles row from the API server.
   *
   * This replaces the old direct Supabase client queries to `public.users`.
   * The API server is now the single point of access for profile data and
   * returns the canonical shape including `onboardingCompletedAt`.
   */
  async getProfile(userId) {
    try {
      const data = await apiRequest<{
        id: string;
        displayName: string | null;
        avatarUrl: string | null;
        email: string | null;
        birthdate: string | null;
        modelPhotoUrl: string | null;
        onboardingCompletedAt: string | null;
      }>("/api/profile");

      if (!data) return null;

      return {
        name: data.displayName ?? null,
        avatarUrl: data.avatarUrl ?? null,
        email: data.email ?? null,
        birthdate: data.birthdate ?? null,
        modelPhotoStoragePath: data.modelPhotoUrl ?? null,
        hasCompletedOnboarding: data.onboardingCompletedAt !== null,
      };
    } catch {
      return null;
    }
  },

  async updateProfile(userId, data) {
    await apiRequest("/api/profile", {
      method: "PATCH",
      body: JSON.stringify({
        ...(data.name !== undefined ? { displayName: data.name } : {}),
        ...(data.birthdate !== undefined ? { birthdate: data.birthdate } : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
      }),
    });
  },

  async updateModelUrl(userId, storagePath) {
    await apiRequest("/api/profile", {
      method: "PATCH",
      body: JSON.stringify({ modelPhotoUrl: storagePath }),
    });
  },

  /**
   * uploadModelPhoto — uploads to the private `user-models` bucket.
   *
   * Returns the storage PATH (not a public URL). The caller must request a
   * signed URL via GET /api/auth/model-photo-url when they need to display
   * the image or pass it to the VTO pipeline.
   */
  async uploadModelPhoto(userId, uri) {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const timestamp = Date.now();
      // Store directly under the user's folder — policy enforces ownership
      const storagePath = `${userId}/model_${timestamp}.jpg`;

      const { data, error } = await supabase.storage
        .from("user-models")
        .upload(storagePath, blob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (error || !data) return null;

      // Return the storage PATH, not a public URL
      return data.path;
    } catch {
      return null;
    }
  },

  /**
   * getModelPhotoSignedUrl — fetches a signed URL from the API server.
   *
   * The bucket is private so we ask the server (which has the service-role key)
   * to issue a short-lived signed URL rather than constructing one client-side.
   */
  async getModelPhotoSignedUrl() {
    try {
      const data = await apiRequest<{ signedUrl: string | null }>(
        "/api/auth/model-photo-url",
      );
      return data?.signedUrl ?? null;
    } catch {
      return null;
    }
  },

  /**
   * syncProfile — tells the API server to refresh the profiles row with the
   * latest OAuth metadata (name, avatar URL, email). Replaces the old
   * `syncGoogleProfile` that wrote directly to `public.users`.
   */
  async syncProfile() {
    await apiRequest("/api/auth/sync-profile", { method: "POST" }).catch(
      () => {},
    );
  },

  /**
   * completeOnboarding — persists the onboarding completion flag to the DB
   * via the API server. Also stores the model photo storage path if provided.
   */
  async completeOnboarding(userId, modelPhotoPath) {
    await apiRequest("/api/auth/complete-onboarding", {
      method: "POST",
      body: JSON.stringify({
        ...(modelPhotoPath ? { modelPhotoPath } : {}),
      }),
    });
  },

  onAuthStateChange(callback) {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
    return subscription;
  },
};

// ── Test double ───────────────────────────────────────────────────────────────

export class FakeAuthAdapter implements AuthAdapter {
  private _session: Session | null = null;
  private _user: User | null = null;
  private _profiles: Record<string, UserProfile> = {};
  private _onboarded: Record<string, boolean> = {};
  private _modelPaths: Record<string, string> = {};
  private _listeners: Array<(s: Session | null) => void> = [];

  public shouldFailSignIn = false;

  isConfigured() {
    return true;
  }

  async getSession() {
    return { session: this._session, user: this._user };
  }

  async signIn() {
    if (this.shouldFailSignIn) throw new Error("Mock signIn failed");
    this._user = { id: "test-user-id", email: "test@example.com" } as User;
    this._session = { user: this._user } as Session;
    this._notify();
  }

  async signInWithEmail(email: string, _password: string) {
    if (this.shouldFailSignIn) throw new Error("Mock signIn failed");
    this._user = { id: "test-user-id", email } as User;
    this._session = { user: this._user } as Session;
    this._notify();
  }

  async signUpWithEmail(email: string, _password: string) {
    if (this.shouldFailSignIn) throw new Error("Mock signUp failed");
    this._user = { id: "test-user-id", email } as User;
    this._session = { user: this._user } as Session;
    this._notify();
  }

  async signOut() {
    this._user = null;
    this._session = null;
    this._notify();
  }

  async getProfile(userId: string) {
    const p = this._profiles[userId];
    if (!p) return null;
    return {
      ...p,
      hasCompletedOnboarding: this._onboarded[userId] ?? false,
      modelPhotoStoragePath: this._modelPaths[userId] ?? null,
    };
  }

  async updateProfile(userId: string, data: Partial<UserProfile>) {
    this._profiles[userId] = { ...this._profiles[userId], ...data } as UserProfile;
  }

  async updateModelUrl(userId: string, storagePath: string) {
    this._modelPaths[userId] = storagePath;
  }

  async uploadModelPhoto(_userId: string, _uri: string) {
    return "mock-user-id/model_123.jpg";
  }

  async getModelPhotoSignedUrl() {
    return "https://mock-signed.supabase.co/user-models/mock-user-id/model_123.jpg?token=fake";
  }

  async syncProfile() {
    // no-op in tests
  }

  async completeOnboarding(userId: string, _modelPhotoPath?: string) {
    this._onboarded[userId] = true;
  }

  onAuthStateChange(callback: (s: Session | null) => void) {
    this._listeners.push(callback);
    return {
      unsubscribe: () => {
        this._listeners = this._listeners.filter((cb) => cb !== callback);
      },
    };
  }

  private _notify() {
    for (const listener of this._listeners) {
      listener(this._session);
    }
  }

  // Test helpers
  setInitialSession(session: Session, user: User) {
    this._session = session;
    this._user = user;
  }

  setOnboarded(userId: string, value = true) {
    this._onboarded[userId] = value;
  }
}
