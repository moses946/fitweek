import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  DailyForecast,
  ForecastResult,
  getWeatherForecast,
  getWeatherForecastByCity,
} from "@/lib/weather";

const CITY_KEY = "@fitweek/fallback_city";

type LocationPermission = "unknown" | "granted" | "denied";

interface WeatherContextValue {
  /** 7-day forecast, null until first load or when unavailable */
  forecast: DailyForecast[] | null;
  usingCache: boolean;
  weatherUnavailable: boolean;
  isLoading: boolean;
  /** Permission status for device location */
  locationPermission: LocationPermission;
  /** User-set fallback city name */
  city: string | null;
  /** Request GPS permission, then fetch weather */
  requestLocationAndFetch: () => Promise<void>;
  /** Save a fallback city and fetch weather for it */
  setCity: (city: string) => Promise<void>;
  /** Clear the fallback city */
  clearCity: () => Promise<void>;
  /** Force a fresh fetch using the current location/city */
  refresh: () => Promise<void>;
}

const WeatherContext = createContext<WeatherContextValue | null>(null);

function applyResult(
  result: ForecastResult,
  set: {
    setForecast: (d: DailyForecast[] | null) => void;
    setUsingCache: (b: boolean) => void;
    setUnavailable: (b: boolean) => void;
  },
) {
  set.setForecast(result.weatherUnavailable ? null : result.days);
  set.setUsingCache(result.usingCache);
  set.setUnavailable(result.weatherUnavailable);
}

export function WeatherProvider({ children }: { children: React.ReactNode }) {
  const [forecast, setForecast] = useState<DailyForecast[] | null>(null);
  const [usingCache, setUsingCache] = useState(false);
  const [weatherUnavailable, setUnavailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [locationPermission, setLocationPermission] =
    useState<LocationPermission>("unknown");
  const [city, setLocalCity] = useState<string | null>(null);

  const setter = {
    setForecast,
    setUsingCache,
    setUnavailable,
  };

  const fetchByGPS = useCallback(async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const result = await getWeatherForecast(
        loc.coords.latitude,
        loc.coords.longitude,
      );
      applyResult(result, setter);
    } catch {
      setUnavailable(true);
    }
  }, []);

  const fetchByCity = useCallback(async (cityName: string) => {
    const result = await getWeatherForecastByCity(cityName);
    applyResult(result, setter);
  }, []);

  // Initial load
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      // Restore saved city
      let savedCity: string | null = null;
      try {
        savedCity = await AsyncStorage.getItem(CITY_KEY);
        if (mounted) setLocalCity(savedCity);
      } catch {}

      // Check current location permission status (no prompt yet)
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (!mounted) return;

        if (status === "granted") {
          setLocationPermission("granted");
          await fetchByGPS();
        } else if (savedCity) {
          await fetchByCity(savedCity);
        } else {
          setLocationPermission(status === "denied" ? "denied" : "unknown");
          setUnavailable(true);
        }
      } catch {
        if (mounted) setUnavailable(true);
      }

      if (mounted) setIsLoading(false);
    };

    init();
    return () => { mounted = false; };
  }, []);

  const requestLocationAndFetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === "granted" ? "granted" : "denied");

      if (status === "granted") {
        await fetchByGPS();
      } else if (city) {
        await fetchByCity(city);
      } else {
        setUnavailable(true);
      }
    } catch {
      setUnavailable(true);
    } finally {
      setIsLoading(false);
    }
  }, [city, fetchByGPS, fetchByCity]);

  const setCity = useCallback(
    async (cityName: string) => {
      setIsLoading(true);
      try {
        await AsyncStorage.setItem(CITY_KEY, cityName);
        setLocalCity(cityName);
        await fetchByCity(cityName);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchByCity],
  );

  const clearCity = useCallback(async () => {
    await AsyncStorage.removeItem(CITY_KEY);
    setLocalCity(null);
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      if (locationPermission === "granted") {
        await fetchByGPS();
      } else if (city) {
        await fetchByCity(city);
      } else {
        setUnavailable(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, [locationPermission, city, fetchByGPS, fetchByCity]);

  return (
    <WeatherContext.Provider
      value={{
        forecast,
        usingCache,
        weatherUnavailable,
        isLoading,
        locationPermission,
        city,
        requestLocationAndFetch,
        setCity,
        clearCity,
        refresh,
      }}
    >
      {children}
    </WeatherContext.Provider>
  );
}

export function useWeather(): WeatherContextValue {
  const ctx = useContext(WeatherContext);
  if (!ctx) throw new Error("useWeather must be used inside WeatherProvider");
  return ctx;
}
