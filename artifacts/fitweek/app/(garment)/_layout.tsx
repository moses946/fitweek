import { Stack } from "expo-router";

export default function GarmentLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, presentation: "modal" }} />
  );
}
