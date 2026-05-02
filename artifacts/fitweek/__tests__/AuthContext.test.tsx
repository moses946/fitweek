/**
 * Issue 1 — TDD: AuthContext unit tests
 *
 * Tests use mocked Supabase client and AsyncStorage.
 * Run with: pnpm test (requires jest-expo setup in package.json)
 *
 * Red → Green → Refactor: write these tests before changing AuthContext.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { renderHook, act, waitFor } from "@testing-library/react-native";
import React from "react";

// --- Mocks ---

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockSignInWithOAuth = jest.fn();
const mockSignOut = jest.fn();
const mockFrom = jest.fn();

jest.mock("../lib/supabase", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithOAuth: mockSignInWithOAuth,
      signOut: mockSignOut,
      setSession: jest.fn(),
    },
    from: mockFrom,
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
  requestCameraPermissionsAsync: jest.fn(() => ({ status: "granted" })),
  requestMediaLibraryPermissionsAsync: jest.fn(() => ({ status: "granted" })),
  launchImageLibraryAsync: jest.fn(),
}));

// --- Helpers ---

import { AuthProvider, useAuth } from "../contexts/AuthContext";

const mockSession = {
  user: {
    id: "user-123",
    email: "test@example.com",
    user_metadata: { full_name: "Test User" },
  },
  access_token: "access-token",
  refresh_token: "refresh-token",
};

const noSubscription = {
  data: {
    subscription: { unsubscribe: jest.fn() },
  },
};

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

// --- Tests ---

describe("AuthContext — Test 1: valid session in storage", () => {
  it("returns the session and user when Supabase has an active session", async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: mockSession } });
    mockOnAuthStateChange.mockReturnValueOnce(noSubscription);

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
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });
    mockOnAuthStateChange.mockReturnValueOnce(noSubscription);

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
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });
    mockOnAuthStateChange.mockReturnValueOnce(noSubscription);
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
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });
    mockOnAuthStateChange.mockReturnValueOnce(noSubscription);
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
    mockGetSession.mockResolvedValueOnce({ data: { session: mockSession } });
    mockOnAuthStateChange.mockImplementationOnce((callback) => {
      // Simulate auth state change to null on signOut
      return noSubscription;
    });
    mockSignOut.mockResolvedValueOnce({});
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
    mockGetSession.mockRejectedValueOnce(new Error("Network error"));
    mockOnAuthStateChange.mockReturnValueOnce(noSubscription);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
  });
});
