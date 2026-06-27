import * as ImagePicker from "expo-image-picker";
import { useCallback, useState } from "react";
import { Alert, Platform } from "react-native";

export interface UsePhotoPickerResult {
  /** Pick a photo from the library. Returns the local URI or null if cancelled. */
  pickPhoto: () => Promise<string | null>;
  /** True while the image picker is open or permission dialog is active. */
  isPicking: boolean;
  /**
   * Request media library permission explicitly before showing the picker.
   * Call this in a user-triggered flow (e.g. onPress) for best UX.
   */
  requestPermission: () => Promise<boolean>;
}

/**
 * usePhotoPicker — React hook encapsulating all Expo ImagePicker interactions.
 *
 * Extracted from AuthStore so the store never depends on Expo platform APIs.
 * The store only receives the resulting URI after the user picks a photo.
 *
 * Usage:
 *   const { pickPhoto, isPicking, requestPermission } = usePhotoPicker();
 *
 *   const handlePress = async () => {
 *     const uri = await pickPhoto();
 *     if (uri) setPhotoUri(uri);
 *   };
 */
export function usePhotoPicker({
  aspect = [3, 4],
  quality = 0.85,
}: {
  /** Crop aspect ratio — defaults to 3:4 (portrait). */
  aspect?: [number, number];
  /** JPEG quality 0–1 — defaults to 0.85. */
  quality?: number;
} = {}): UsePhotoPickerResult {
  const [isPicking, setIsPicking] = useState(false);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    // Android and web don't require explicit permission before launching the
    // media library — the system handles it. iOS (non-web) does.
    if (Platform.OS !== "ios") return true;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status === "denied") {
      Alert.alert(
        "Photo access needed",
        "Fitweek needs access to your photo library to set your model photo. Enable it in Settings → Privacy → Photos.",
        [{ text: "OK" }],
      );
      return false;
    }

    return status === "granted";
  }, []);

  const pickPhoto = useCallback(async (): Promise<string | null> => {
    setIsPicking(true);
    try {
      const granted = await requestPermission();
      if (!granted) return null;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect,
        quality,
      });

      if (result.canceled) return null;
      return result.assets[0]?.uri ?? null;
    } finally {
      setIsPicking(false);
    }
  }, [aspect, quality, requestPermission]);

  return { pickPhoto, isPicking, requestPermission };
}
