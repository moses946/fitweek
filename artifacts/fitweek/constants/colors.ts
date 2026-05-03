/**
 * FitWeek design tokens — aligned to fitweek-design.md
 *
 * Gradient: #8B2FF5 → #2563EB (135°)
 * Page bg:  #F8F7FF (lavender-tinted white)
 * Navy:     #1A1F36 (primary text)
 * Border:   #E4E0F5 (purple-tinted)
 */

const colors = {
  light: {
    // Text
    text: "#1A1F36",
    foreground: "#1A1F36",
    slate: "#64748B",
    hint: "#A0ABBB",

    // Surfaces
    background: "#F8F7FF",
    card: "#FFFFFF",
    cardForeground: "#1A1F36",
    surfaceWash: "#F0EEFE",

    // Primary — solid fallback (use gradientPrimary for CTAs)
    primary: "#8B2FF5",
    primaryEnd: "#2563EB",
    primaryForeground: "#FFFFFF",

    // Secondary
    secondary: "#F0EEFE",
    secondaryForeground: "#1A1F36",

    // Muted
    muted: "#F0EEFE",
    mutedForeground: "#64748B",

    // Accent — gradient start
    accent: "#8B2FF5",
    accentForeground: "#FFFFFF",

    // Borders
    border: "#E4E0F5",
    borderStrong: "#C4BAF0",
    input: "#E4E0F5",

    // Garment status
    statusClean: "#10B981",
    statusCleanBg: "#ECFDF5",
    statusWorn: "#64748B",
    statusLaundry: "#0EA5E9",
    statusLaundryBg: "#F0F9FF",

    // Weather warning
    statusWarn: "#F59E0B",
    statusWarnBg: "#FFFBEB",

    // Gradient overlay
    gradientGlass: "rgba(139, 47, 245, 0.08)",

    // Destructive
    destructive: "#EF4444",
    destructiveForeground: "#FFFFFF",

    // Legacy alias
    tint: "#8B2FF5",
  },

  /** Primary gradient — use with LinearGradient */
  gradientPrimary: ["#8B2FF5", "#2563EB"] as [string, string],

  /** Radius tokens */
  radius: 16,
  radiusSheet: 24,
  radiusButton: 12,
  radiusChip: 8,
  radiusBadge: 6,
};

export default colors;
