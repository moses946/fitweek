import { Session, User } from "@supabase/supabase-js";

// ── Public types ──────────────────────────────────────────────────────────────

export interface UserProfile {
  name: string | null;
  avatarUrl: string | null;
  email: string | null;
  birthdate: string | null;
  /** Storage PATH for the model photo — NOT a public URL. */
  modelPhotoStoragePath: string | null;
  /** Derived from `onboarding_completed_at` in the profiles row. */
  hasCompletedOnboarding: boolean;
}

export interface AuthState {
  session: Session | null;
  user: User | null;
  /** True while the initial session or profile data is being loaded. */
  isLoading: boolean;
  /**
   * Derived from `profiles.onboarding_completed_at`.
   * Authoritative source is the API/DB — AsyncStorage is no longer used
   * to track this flag (avoids data loss on device wipe / app reinstall).
   */
  hasCompletedOnboarding: boolean;
  /**
   * Signed URL for the model photo. Valid for ~1 hour; the store
   * refreshes it automatically when the profile is reloaded.
   * NULL if no photo has been uploaded.
   */
  modelPhotoSignedUrl: string | null;
  userProfile: UserProfile | null;
}

export type AuthListener = (state: AuthState) => void;

// ── Adapter interface ─────────────────────────────────────────────────────────

export interface AuthAdapter {
  isConfigured(): boolean;
  getSession(): Promise<{ session: Session | null; user: User | null }>;
  signIn(): Promise<void>;
  signInWithEmail(email: string, password: string): Promise<void>;
  signUpWithEmail(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  getProfile(userId: string): Promise<(UserProfile & { hasCompletedOnboarding: boolean }) | null>;
  updateProfile(userId: string, data: Partial<UserProfile>): Promise<void>;
  updateModelUrl(userId: string, storagePath: string): Promise<void>;
  uploadModelPhoto(userId: string, uri: string): Promise<string | null>;
  getModelPhotoSignedUrl(): Promise<string | null>;
  syncProfile(): Promise<void>;
  completeOnboarding(userId: string, modelPhotoPath?: string): Promise<void>;
  onAuthStateChange(callback: (session: Session | null) => void): { unsubscribe: () => void };
}

// ── Store ─────────────────────────────────────────────────────────────────────

export class AuthStore {
  private adapter: AuthAdapter;
  private state: AuthState;
  private listeners: Set<AuthListener> = new Set();
  private subscription: { unsubscribe: () => void } | null = null;

  constructor(adapter: AuthAdapter) {
    this.adapter = adapter;
    this.state = {
      session: null,
      user: null,
      isLoading: true,
      hasCompletedOnboarding: false,
      modelPhotoSignedUrl: null,
      userProfile: null,
    };
  }

  getState(): AuthState {
    return this.state;
  }

  subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private patchState(update: Partial<AuthState>) {
    this.state = { ...this.state, ...update };
    this.notify();
  }

  async init() {
    const { session, user } = await this.adapter.getSession();
    this.patchState({ session, user });

    await this.loadUserData(user?.id);
    this.patchState({ isLoading: false });

    this.subscription = this.adapter.onAuthStateChange(async (newSession) => {
      const newUser = newSession?.user ?? null;
      this.patchState({ session: newSession, user: newUser });

      if (newUser) {
        // Fire-and-forget: sync OAuth metadata to the profiles row
        this.adapter.syncProfile().catch(() => {});
      } else {
        this.patchState({ userProfile: null, modelPhotoSignedUrl: null });
      }

      await this.loadUserData(newUser?.id);
    });
  }

  destroy() {
    this.subscription?.unsubscribe();
  }

  /**
   * loadUserData — loads the profile from the API server.
   *
   * The API server is the single authoritative source for:
   *   - hasCompletedOnboarding (from `profiles.onboarding_completed_at`)
   *   - userProfile (display name, avatar, email, birthdate)
   *   - modelPhotoStoragePath (used to request a signed URL)
   *
   * AsyncStorage is NO LONGER used for onboarding or model photo state.
   */
  private async loadUserData(userId: string | undefined) {
    if (!userId || !this.adapter.isConfigured()) {
      this.patchState({
        hasCompletedOnboarding: false,
        modelPhotoSignedUrl: null,
        userProfile: null,
      });
      return;
    }

    try {
      const profile = await this.adapter.getProfile(userId);
      if (!profile) {
        this.patchState({ hasCompletedOnboarding: false, userProfile: null });
        return;
      }

      const { hasCompletedOnboarding, modelPhotoStoragePath, ...userProfileData } =
        profile;

      // Fetch a fresh signed URL if the user has a model photo
      let modelPhotoSignedUrl: string | null = null;
      if (modelPhotoStoragePath) {
        modelPhotoSignedUrl = await this.adapter
          .getModelPhotoSignedUrl()
          .catch(() => null);
      }

      this.patchState({
        hasCompletedOnboarding,
        modelPhotoSignedUrl,
        userProfile: {
          name: userProfileData.name,
          avatarUrl: userProfileData.avatarUrl,
          email: userProfileData.email,
          birthdate: userProfileData.birthdate,
          modelPhotoStoragePath,
          hasCompletedOnboarding,
        },
      });
    } catch {
      // Non-fatal — keep previous state so offline users aren't logged out
    }
  }

  // ── Auth operations ─────────────────────────────────────────────────────────

  async signIn() {
    await this.adapter.signIn();
  }

  async signInWithEmail(email: string, password: string) {
    await this.adapter.signInWithEmail(email, password);
  }

  async signUpWithEmail(email: string, password: string) {
    await this.adapter.signUpWithEmail(email, password);
  }

  async signOut() {
    try {
      await this.adapter.signOut();
    } catch {
      // Ignore sign-out errors — clear state regardless
    }

    this.patchState({
      modelPhotoSignedUrl: null,
      hasCompletedOnboarding: false,
      userProfile: null,
      session: null,
      user: null,
    });
  }

  // ── Onboarding ──────────────────────────────────────────────────────────────

  /**
   * completeOnboarding — persists the onboarding completion to the API server.
   *
   * @param modelPhotoUri  Local device URI or remote URL of the chosen photo.
   *                       If it's a local URI and Supabase is configured, the
   *                       photo is uploaded and the storage path is persisted.
   *                       Pass `null` to skip the model photo entirely.
   */
  async completeOnboarding(modelPhotoUri: string | null) {
    const userId = this.state.user?.id;
    if (!userId) return;

    let modelPhotoPath: string | undefined;

    if (modelPhotoUri) {
      const isLocal =
        !modelPhotoUri.startsWith("http://") &&
        !modelPhotoUri.startsWith("https://");

      if (isLocal && this.adapter.isConfigured()) {
        // Upload and get back the storage PATH (not a public URL)
        const path = await this.adapter
          .uploadModelPhoto(userId, modelPhotoUri)
          .catch(() => null);
        if (path) modelPhotoPath = path;
      }
    }

    // Persist the completion flag (and optional photo path) to the DB
    await this.adapter.completeOnboarding(userId, modelPhotoPath);

    // Fetch a signed URL for immediate display if a photo was uploaded
    let modelPhotoSignedUrl: string | null = null;
    if (modelPhotoPath) {
      modelPhotoSignedUrl = await this.adapter
        .getModelPhotoSignedUrl()
        .catch(() => null);
    }

    this.patchState({
      hasCompletedOnboarding: true,
      modelPhotoSignedUrl,
      userProfile: this.state.userProfile
        ? {
            ...this.state.userProfile,
            modelPhotoStoragePath: modelPhotoPath ?? null,
            hasCompletedOnboarding: true,
          }
        : null,
    });
  }

  // ── Profile mutations ───────────────────────────────────────────────────────

  async updateBirthdate(birthdate: string) {
    const userId = this.state.user?.id;
    const profile = this.state.userProfile;

    // Optimistic update
    this.patchState({
      userProfile: profile
        ? { ...profile, birthdate }
        : {
            name: null,
            avatarUrl: null,
            email: null,
            birthdate,
            modelPhotoStoragePath: null,
            hasCompletedOnboarding: false,
          },
    });

    if (userId && this.adapter.isConfigured()) {
      this.adapter.updateProfile(userId, { birthdate }).catch(() => {});
    }
  }
}

// ── Exported convenience types ────────────────────────────────────────────────

export type AuthContextValue = AuthState & {
  signIn: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: (modelPhotoUri: string | null) => Promise<void>;
  updateBirthdate: (birthdate: string) => Promise<void>;
};
