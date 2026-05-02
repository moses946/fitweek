/**
 * FitWeek design tokens — aligned to brand-system.md
 *
 * Palette:  90% neutral slate + 10% #7B61FF→#4DA3FF gradient
 * Status:   Clean #22C55E | Laundry #F97316 | Worn #64748B
 * Radius:   16px cards, 12–14px buttons
 */

const colors = {
  light: {
    // Text
    text: "#0F172A",
    foreground: "#0F172A",

    // Surfaces
    background: "#F1F5F9",
    card: "#FFFFFF",
    cardForeground: "#0F172A",

    // Primary — solid fallback (use gradientPrimary for CTAs)
    primary: "#7B61FF",
    primaryEnd: "#4DA3FF",
    primaryForeground: "#FFFFFF",

    // Secondary
    secondary: "#F1F5F9",
    secondaryForeground: "#0F172A",

    // Muted
    muted: "#E2E8F0",
    mutedForeground: "#64748B",

    // Accent — matches gradient start
    accent: "#7B61FF",
    accentForeground: "#FFFFFF",

    // Borders & inputs
    border: "#E2E8F0",
    input: "#E2E8F0",

    // Garment status (brand-system.md §Status Colors)
    statusClean: "#22C55E",
    statusWorn: "#64748B",
    statusLaundry: "#F97316",

    // Destructive
    destructive: "#EF4444",
    destructiveForeground: "#FFFFFF",

    // Legacy alias
    tint: "#7B61FF",
  },

  /** Primary gradient — use with LinearGradient */
  gradientPrimary: ["#7B61FF", "#4DA3FF"] as [string, string],

  /** 8pt-grid radius */
  radius: 16,
};

export default colors;
