/**
 * Issue 1 — TDD: AuthContext unit tests
 *
 * Tests use mocked Supabase client and AsyncStorage.
 * Run with: pnpm --filter @workspace/fitweek test
 *
 * Pattern: jest.fn() declared inside jest.mock factory (avoids hoisting issues),
 * then retrieved via jest.requireMock() for per-test mock setup.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { renderHook, act, waitFor } from "@testing-library/react-native";
import React from "react";

// --- Mocks ---

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("../lib/supabase", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      signInWithOAuth: jest.fn(),
      signOut: jest.fn(),
      setSession: jest.fn(),
    },
    from: jest.fn(() => ({
      upsert: jest.fn(() => ({ data: null, error: null })),
    })),
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(() => ({ data: null, error: null })),
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: null } })),
      })),
    },
  },
}));

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));

jest.mock("expo-linking", () => ({
  createURL: jest.fn(() => "fitweek://auth/callback"),
}));

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ status: "granted" })),
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: "granted" })),
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: true, assets: [] })),
}));

// --- Helpers ---

import { AuthProvider, useAuth } from "../contexts/AuthContext";

// Access the auto-injected jest.fn() instances for per-test setup
const supabaseMock = (jest.requireMock("../lib/supabase") as { supabase: { auth: { getSession: jest.Mock; onAuthStateChange: jest.Mock; signOut: jest.Mock }; from: jest.Mock } }).supabase;

const mockSession = {
  user: {
    id: "user-123",
    email: "test@example.com",
    user_metadata: { full_name: "Test User" },
  },
  access_token: "access-token",
  refresh_token: "refresh-token",
};

function noSubscription() {
  return { data: { subscription: { unsubscribe: jest.fn() } } };
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: onAuthStateChange returns a valid subscription object
  supabaseMock.auth.onAuthStateChange.mockReturnValue(noSubscription());
});

// --- Tests ---

describe("AuthContext — Test 1: valid session in storage", () => {
  it("returns the session and user when Supabase has an active session", async () => {
    supabaseMock.auth.getSession.mockResolvedValueOnce({ data: { session: mockSession } });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.session).toEqual(mockSession);
    expect(result.current.user?.id).toBe("user-123");
  });
});

describe("AuthContext — Test 2: no session in storage", () => {
  it("returns null session and user when no session exists", async () => {
    supabaseMock.auth.getSession.mockResolvedValueOnce({ data: { session: null } });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
  });
});

describe("AuthContext — Test 3: onboarding not complete by default", () => {
  it("returns hasCompletedOnboarding = false when AsyncStorage is empty", async () => {
    supabaseMock.auth.getSession.mockResolvedValueOnce({ data: { session: null } });
    await AsyncStorage.clear();

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasCompletedOnboarding).toBe(false);
  });
});

describe("AuthContext — Test 4: completeOnboarding sets flag", () => {
  it("sets hasCompletedOnboarding to true after completeOnboarding is called", async () => {
    supabaseMock.auth.getSession.mockResolvedValueOnce({ data: { session: null } });
    await AsyncStorage.clear();

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.completeOnboarding(null);
    });

    expect(result.current.hasCompletedOnboarding).toBe(true);
  });
});

describe("AuthContext — Test 5: signOut clears session and onboarding", () => {
  it("clears session and hasCompletedOnboarding after signOut", async () => {
    supabaseMock.auth.getSession.mockResolvedValueOnce({ data: { session: mockSession } });
    supabaseMock.auth.signOut.mockResolvedValueOnce({});
    await AsyncStorage.setItem("@fitweek/onboarding_complete", "true");

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.hasCompletedOnboarding).toBe(false);
    const stored = await AsyncStorage.getItem("@fitweek/onboarding_complete");
    expect(stored).toBeNull();
  });
});

describe("AuthContext — Test 6: Supabase error on getSession is handled gracefully", () => {
  it("falls back to null session without throwing when Supabase is unreachable", async () => {
    supabaseMock.auth.getSession.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
  });
});
