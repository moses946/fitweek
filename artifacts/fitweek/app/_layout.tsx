import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from "@expo-google-fonts/poppins";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { GarmentProvider } from "@/contexts/GarmentContext";
import { OutfitSlotProvider } from "@/contexts/OutfitSlotContext";
import { WeatherProvider } from "@/contexts/WeatherContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AuthGate() {
  const { session, isLoading, hasCompletedOnboarding } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navState = useRootNavigationState();

  useEffect(() => {
    if (!navState?.key || isLoading) return;

    const inAuth = segments[0] === "(auth)" || segments[0] === "auth";
    const inOnboarding = segments[0] === "(onboarding)";

    if (!session) {
      if (!inAuth) router.replace("/(auth)/sign-in");
    } else if (!hasCompletedOnboarding) {
      if (!inOnboarding) router.replace("/(onboarding)/model-photo");
    } else {
      if (inAuth) router.replace("/(tabs)");
    }
  }, [session, isLoading, hasCompletedOnboarding, segments, navState?.key]);

  return null;
}

function RootLayoutNav() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(garment)" options={{ presentation: "modal" }} />
        <Stack.Screen name="(swipe)" options={{ presentation: "modal" }} />
        <Stack.Screen name="auth/callback" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <AuthGate />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <GarmentProvider>
                  <OutfitSlotProvider>
                    <WeatherProvider>
                      <RootLayoutNav />
                    </WeatherProvider>
                  </OutfitSlotProvider>
                </GarmentProvider>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
