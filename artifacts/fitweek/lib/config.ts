/**
 * Centralized client configuration baked in at build time via EXPO_PUBLIC_* env vars.
 */

const DEV_API_DEFAULT = "http://localhost:8080";

function requireInProduction(value: string | undefined, name: string): string {
  if (value) return value;
  if (__DEV__) return DEV_API_DEFAULT;
  throw new Error(
    `${name} is required for production builds. Set it in EAS secrets or .env.`,
  );
}

/** Base URL for the FitWeek API (Cloud Run in production). */
export const API_BASE_URL = requireInProduction(
  process.env.EXPO_PUBLIC_API_BASE_URL,
  "EXPO_PUBLIC_API_BASE_URL",
);

export const PRIVACY_POLICY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? "";

export const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL ?? "";
