import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import colors from "@/constants/colors";

interface GradientButtonProps {
  onPress?: () => void;
  label: string;
  isLoading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  leftElement?: React.ReactNode;
}

/**
 * Primary CTA button with the FitWeek brand gradient (#7B61FF → #4DA3FF).
 * Height ≥ 54px to satisfy the 44pt tap-target guideline.
 */
export function GradientButton({
  onPress,
  label,
  isLoading,
  disabled,
  style,
  testID,
  leftElement,
}: GradientButtonProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || isLoading}
      style={[styles.pressable, style]}
    >
      {({ pressed }) => (
        <LinearGradient
          colors={colors.gradientPrimary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.gradient, { opacity: pressed || disabled ? 0.75 : 1 }]}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View style={styles.inner}>
              {leftElement}
              <Text style={styles.label}>{label}</Text>
            </View>
          )}
        </LinearGradient>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { width: "100%" },
  gradient: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  label: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
});
