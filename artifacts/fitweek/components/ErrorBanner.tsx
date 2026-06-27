import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { useColors } from "@/hooks/useColors";

interface ErrorBannerProps {
  message: string | null;
  onDismiss: () => void;
  type?: "error" | "success" | "warning";
}

export function ErrorBanner({ message, onDismiss, type = "error" }: ErrorBannerProps) {
  const colors = useColors();

  if (!message) return null;

  let backgroundColor, borderColor, iconColor, iconName;

  switch (type) {
    case "error":
      backgroundColor = "rgba(239, 68, 68, 0.1)"; // Red tint
      borderColor = "rgba(239, 68, 68, 0.3)";
      iconColor = "#EF4444";
      iconName = "alert-circle";
      break;
    case "success":
      backgroundColor = "rgba(16, 185, 129, 0.1)"; // Emerald tint
      borderColor = "rgba(16, 185, 129, 0.3)";
      iconColor = "#10B981";
      iconName = "check-circle";
      break;
    case "warning":
      backgroundColor = "rgba(245, 158, 11, 0.1)"; // Amber tint
      borderColor = "rgba(245, 158, 11, 0.3)";
      iconColor = "#F59E0B";
      iconName = "alert-triangle";
      break;
  }

  return (
    <View style={[styles.container, { backgroundColor, borderColor }]}>
      <Feather name={iconName as any} size={16} color={iconColor} style={styles.icon} />
      <Text style={[styles.message, { color: colors.foreground }]}>{message}</Text>
      <Pressable onPress={onDismiss} hitSlop={12} style={styles.closeButton}>
        <Feather name="x" size={16} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  icon: {
    marginTop: 2,
    marginRight: 8,
  },
  message: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    lineHeight: 18,
  },
  closeButton: {
    marginLeft: 8,
    padding: 2,
  },
});
