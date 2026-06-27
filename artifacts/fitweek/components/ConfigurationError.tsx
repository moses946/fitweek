import React from "react";
import { StyleSheet, Text, View } from "react-native";

/**
 * Shown when required EXPO_PUBLIC_* vars are missing in a production build.
 */
export function ConfigurationError({ message }: { message: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Configuration error</Text>
      <Text style={styles.body}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#F7F5F2",
  },
  title: {
    fontSize: 20,
    fontFamily: "Poppins_600SemiBold",
    color: "#1A1A1A",
    marginBottom: 12,
  },
  body: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
});
